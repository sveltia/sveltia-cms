/* eslint-disable no-await-in-loop */

import { sleep } from '@sveltia/utils/misc';
import { get } from 'svelte/store';

import { getAssetKind } from '$lib/services/assets/kinds';
import { cmsConfig } from '$lib/services/config';
import { parseXml } from '$lib/services/utils/xml';

/**
 * @import {
 * ExternalAsset,
 * MediaLibraryFetchOptions,
 * MediaLibraryService,
 * } from '$lib/types/private';
 * @import { AzureMediaLibrary, CmsConfig, MediaField } from '$lib/types/public';
 */

/**
 * A blob entry in the `List Blobs` response.
 * @typedef {object} AzureBlob
 * @property {string} Name Blob name, including any virtual directory within the container.
 * @property {Record<string, string>} [Properties] Blob properties, such as `Last-Modified`,
 * `Content-Length` and `Content-Type`.
 */

/**
 * Blob service endpoint suffix for the Azure public cloud.
 */
const DEFAULT_ENDPOINT_SUFFIX = 'blob.core.windows.net';
/**
 * Number of blobs to request per `List Blobs` call. The service caps the value at 5000.
 */
const MAX_RESULTS = 1000;

/**
 * Get Azure Blob Storage library options from site config.
 * @internal
 * @param {CmsConfig | MediaField} [config] CMS configuration or field configuration.
 * @returns {AzureMediaLibrary | false | undefined} Configuration object, or `false` if explicitly
 * disabled.
 */
export const getLibraryOptions = (config = get(cmsConfig)) =>
  /** @type {AzureMediaLibrary | false | undefined} */ (
    config?.media_libraries?.azure_blob_storage
  ) ??
  (config?.media_library?.name === 'azure_blob_storage'
    ? /** @type {AzureMediaLibrary} */ (config?.media_library)
    : undefined);

/**
 * Check if Azure Blob Storage integration is enabled.
 * @param {MediaField} [fieldConfig] Field configuration.
 * @returns {boolean} True if enabled, false otherwise.
 */
export const isEnabled = (fieldConfig) => {
  const options = getLibraryOptions(fieldConfig) ?? getLibraryOptions();

  return !!(options && options.container && (options.account_name || options.endpoint));
};

/**
 * Get the resolved library options for the given field or global Azure Blob Storage config.
 * @param {MediaLibraryFetchOptions} options Options containing the configuration.
 * @returns {AzureMediaLibrary} Resolved config.
 * @throws {Error} If the Azure Blob Storage configuration is not available.
 */
const getConfig = ({ fieldConfig }) => {
  const libOptions = getLibraryOptions(fieldConfig) ?? getLibraryOptions();

  if (!libOptions) {
    throw new Error('Azure Blob Storage configuration is not available');
  }

  return libOptions;
};

/**
 * Remove any trailing slashes from the given URL.
 * @param {string} url URL.
 * @returns {string} Trimmed URL.
 */
const trimSlashes = (url) => url.replace(/\/+$/, '');

/**
 * Percent-encode a blob name for use in a URL path, keeping the path separators intact.
 * @param {string} key Blob name.
 * @returns {string} Encoded name.
 */
const encodeKey = (key) =>
  key
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');

/**
 * Build the base URL of the container on the Blob service.
 * @param {AzureMediaLibrary} config Azure Blob Storage configuration.
 * @returns {string} Container URL without a trailing slash.
 */
export const buildContainerUrl = ({ account_name: accountName, container, endpoint }) => {
  const base = endpoint
    ? trimSlashes(endpoint)
    : `https://${accountName}.${DEFAULT_ENDPOINT_SUFFIX}`;

  return `${base}/${container}`;
};

/**
 * Build a request URL with the SAS token appended. The token is used as given, rather than parsed
 * and re-serialized, because the percent-encoding of its `sig` parameter must be preserved exactly
 * for the signature to remain valid.
 * @param {object} params Parameters.
 * @param {string} params.url Base URL without a query string.
 * @param {string} params.token SAS token, with or without the leading `?`.
 * @param {URLSearchParams} [params.searchParams] Additional query parameters.
 * @returns {string} Authorized URL.
 */
export const buildRequestUrl = ({ url, token, searchParams }) => {
  const query = [searchParams?.toString(), token.trim().replace(/^[?&]/, '')]
    .filter(Boolean)
    .join('&');

  return `${url}?${query}`;
};

/**
 * Parse blobs returned by the Blob service into the `ExternalAsset` format.
 * @param {AzureBlob[]} blobs Blobs.
 * @param {AzureMediaLibrary} config Azure Blob Storage configuration.
 * @param {string} token SAS token.
 * @returns {ExternalAsset[]} Assets.
 */
export const parseBlobResults = (blobs, config, token) => {
  const { prefix = '', public_url: publicUrl } = config;
  const containerUrl = buildContainerUrl(config);

  return blobs.map(({ Name: key, Properties: properties = {} }) => {
    const fileName = key.split('/').pop() || key;
    const displayKey = prefix && key.startsWith(prefix) ? key.slice(prefix.length) : key;
    const encodedKey = encodeKey(key);
    const blobUrl = `${containerUrl}/${encodedKey}`;
    // Assets are hotlinked, so the URL stored in entries must not contain the SAS token, which
    // expires. A private container therefore requires the `public_url` option; the token is only
    // added to the preview URL, which is used within the CMS
    const downloadURL = publicUrl ? `${trimSlashes(publicUrl)}/${encodedKey}` : blobUrl;
    const lastModified = properties['Last-Modified'];
    const size = properties['Content-Length'];

    return {
      id: key,
      description: displayKey,
      previewURL: publicUrl ? downloadURL : buildRequestUrl({ url: blobUrl, token }),
      downloadURL,
      fileName,
      ...(lastModified && { lastModified: new Date(lastModified) }),
      ...(size && { size: Number(size) }),
      kind: getAssetKind(key),
    };
  });
};

/**
 * List blobs in the configured container.
 * @param {AzureMediaLibrary} config Azure Blob Storage configuration.
 * @param {MediaLibraryFetchOptions} options Fetch options (`apiKey` contains the SAS token).
 * @param {object} [params] Additional parameters.
 * @param {number} [params.maxPages] Maximum number of pages to fetch. Default: 10.
 * @returns {Promise<ExternalAsset[]>} Assets.
 * @see https://learn.microsoft.com/en-us/rest/api/storageservices/list-blobs
 */
export const listBlobs = async (config, options, { maxPages = 10 } = {}) => {
  const { prefix = '' } = config;
  const { kind, apiKey: token } = options;

  if (!token) {
    return Promise.reject(new Error('Azure Blob Storage SAS token is required'));
  }

  const url = buildContainerUrl(config);
  /** @type {AzureBlob[]} */
  const allBlobs = [];
  /** @type {string | undefined} */
  let marker;

  // Fetch up to maxPages pages
  for (let page = 0; page < maxPages; page += 1) {
    const searchParams = new URLSearchParams({
      restype: 'container',
      comp: 'list',
      maxresults: String(MAX_RESULTS),
      ...(prefix && { prefix }),
      ...(marker && { marker }),
    });

    const response = await fetch(buildRequestUrl({ url, token, searchParams }));

    if (!response.ok) {
      const errorText = await response.text();

      return Promise.reject(new Error(`Failed to list blobs: ${errorText}`));
    }

    /** @type {any} */
    const data = parseXml(await response.text());
    const { Blob: blob } = data.Blobs ?? {};
    const blobs = blob ? (Array.isArray(blob) ? blob : [blob]) : [];

    // Filter out the directory placeholders that a hierarchical namespace account may return
    allBlobs.push(...blobs.filter((/** @type {AzureBlob} */ { Name }) => !Name.endsWith('/')));

    marker = data.NextMarker || undefined;

    if (!marker) {
      break;
    }

    // Wait for a bit before requesting the next page
    await sleep(50);
  }

  // Filter by kind if specified
  const filteredBlobs = kind
    ? allBlobs.filter(({ Name }) => getAssetKind(Name) === kind)
    : allBlobs;

  return parseBlobResults(filteredBlobs, config, token);
};

/**
 * Search blobs in the configured container.
 * @param {string} query Search query.
 * @param {AzureMediaLibrary} config Azure Blob Storage configuration.
 * @param {MediaLibraryFetchOptions} options Fetch options (`apiKey` contains the SAS token).
 * @returns {Promise<ExternalAsset[]>} Assets.
 */
export const searchBlobs = async (query, config, options) => {
  // The Blob service doesn’t have a native search, so we list blobs and filter them client-side
  const allAssets = await listBlobs(config, options, { maxPages: 5 });
  const lowerQuery = query.toLowerCase();

  return allAssets.filter(
    (asset) =>
      asset.fileName.toLowerCase().includes(lowerQuery) ||
      asset.description.toLowerCase().includes(lowerQuery),
  );
};

/**
 * Upload files to the configured container as block blobs.
 * @param {File[]} files Files to upload.
 * @param {AzureMediaLibrary} config Azure Blob Storage configuration.
 * @param {MediaLibraryFetchOptions} options Fetch options (`apiKey` contains the SAS token).
 * @returns {Promise<ExternalAsset[]>} Uploaded assets.
 * @see https://learn.microsoft.com/en-us/rest/api/storageservices/put-blob
 */
export const uploadBlobs = async (files, config, options) => {
  if (files.length === 0) {
    return [];
  }

  const { prefix = '' } = config;
  const { apiKey: token } = options;

  if (!token) {
    return Promise.reject(new Error('Azure Blob Storage SAS token is required'));
  }

  const containerUrl = buildContainerUrl(config);
  /** @type {AzureBlob[]} */
  const uploadedBlobs = [];

  // Upload files one by one
  // eslint-disable-next-line no-restricted-syntax
  for (const file of files) {
    // Extract only the filename to prevent path traversal via crafted File objects
    const sanitizedName = file.name.split(/[/\\]/).filter(Boolean).at(-1) ?? file.name;
    const key = prefix ? `${prefix}${sanitizedName}` : sanitizedName;
    const url = `${containerUrl}/${encodeKey(key)}`;
    const fileContent = await file.arrayBuffer();

    const response = await fetch(buildRequestUrl({ url, token }), {
      method: 'PUT',
      headers: {
        // The `x-ms-version` header is omitted on purpose: with a SAS, the token’s `sv` parameter
        // determines the service version, and each extra header must be allowed by a CORS rule
        'x-ms-blob-type': 'BlockBlob',
        'Content-Type': file.type || 'application/octet-stream',
      },
      body: fileContent,
    });

    if (!response.ok) {
      const errorText = await response.text();

      throw new Error(`Failed to upload file ${file.name}: ${errorText}`);
    }

    uploadedBlobs.push({
      Name: key,
      Properties: {
        'Last-Modified': new Date().toUTCString(),
        'Content-Length': String(file.size),
        'Content-Type': file.type,
      },
    });

    // Wait a bit between uploads
    if (files.length > 1) {
      await sleep(50);
    }
  }

  return parseBlobResults(uploadedBlobs, config, token);
};

/**
 * List files from Azure Blob Storage.
 * @param {MediaLibraryFetchOptions} options Options containing the configuration.
 * @returns {Promise<ExternalAsset[]>} Assets.
 */
export const list = async (options) => listBlobs(getConfig(options), options);

/**
 * Search files in Azure Blob Storage.
 * @param {string} query Search query.
 * @param {MediaLibraryFetchOptions} options Options containing the configuration.
 * @returns {Promise<ExternalAsset[]>} Assets.
 */
export const search = async (query, options) => searchBlobs(query, getConfig(options), options);

/**
 * Upload files to Azure Blob Storage.
 * @param {File[]} files Files to upload.
 * @param {MediaLibraryFetchOptions} options Options containing the configuration.
 * @returns {Promise<ExternalAsset[]>} Uploaded assets.
 */
export const upload = async (files, options) => uploadBlobs(files, getConfig(options), options);

/**
 * Azure Blob Storage media library service integration.
 * @type {MediaLibraryService}
 */
export default {
  serviceType: 'cloud_storage',
  serviceId: 'azure_blob_storage',
  serviceLabel: 'Azure Blob Storage',
  serviceURL: 'https://azure.microsoft.com/products/storage/blobs/',
  showServiceLink: true,
  hotlinking: true,
  authType: 'api_key',
  developerURL: 'https://learn.microsoft.com/en-us/rest/api/storageservices/blob-service-rest-api',
  apiKeyURL: 'https://portal.azure.com/#browse/Microsoft.Storage%2FStorageAccounts',
  apiKeyPattern: /^\??(?:[\w-]+=[^&]*&)*sig=[^&]+(?:&[\w-]+=[^&]*)*$/,
  isEnabled,
  list,
  search,
  upload,
};
