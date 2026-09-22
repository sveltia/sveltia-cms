/* eslint-disable no-await-in-loop */

import { sleep } from '@sveltia/utils/misc';

import { getAssetKind } from '$lib/services/assets/kinds';
import { cmsConfig } from '$lib/services/config/state';
import { filterAssetsByQuery } from '$lib/services/integrations/media-libraries/cloud/search';
import {
  findLibraryOptions,
  resolveLibraryOptions,
} from '$lib/services/integrations/media-libraries/options';
import { parseXml } from '$lib/services/utils/xml';

/**
 * @import {
 * ExternalAsset,
 * ExternalFolderListing,
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
 * @param {CmsConfig | MediaField} [config] CMS configuration or field configuration.
 * @returns {AzureMediaLibrary | false | undefined} Configuration object, or `false` if explicitly
 * disabled.
 */
export const getLibraryOptions = (config = cmsConfig.current) =>
  findLibraryOptions('azure_blob_storage', config);

/**
 * Check if Azure Blob Storage integration is enabled.
 * @param {MediaField} [fieldConfig] Field configuration.
 * @returns {boolean} True if enabled, false otherwise.
 */
export const isEnabled = (fieldConfig) => {
  const options = resolveLibraryOptions('azure_blob_storage', fieldConfig);

  return !!(options && options.container && (options.account_name || options.endpoint));
};

/**
 * Get the resolved library options for the given field or global Azure Blob Storage config.
 * @param {MediaLibraryFetchOptions} options Options containing the configuration.
 * @returns {AzureMediaLibrary} Resolved config.
 * @throws {Error} If the Azure Blob Storage configuration is not available.
 */
const getConfig = ({ fieldConfig }) => {
  const libOptions = resolveLibraryOptions('azure_blob_storage', fieldConfig);

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
 * Get the configured prefix as a directory, with a trailing slash. The option is documented as
 * ending with one, but a prefix without it would otherwise glue itself to the blob names and make
 * every path start with a slash, so it’s put right rather than left to break the listing.
 * @param {AzureMediaLibrary} config Azure Blob Storage configuration.
 * @returns {string} Prefix, or an empty string for the container root.
 */
const getPrefix = ({ prefix = '' }) => (prefix && !prefix.endsWith('/') ? `${prefix}/` : prefix);
/**
 * Get the name of the placeholder blob that keeps an empty folder, which is the folder path with a
 * trailing slash, the way Azure Storage Explorer creates a virtual directory.
 * @param {AzureMediaLibrary} config Azure Blob Storage configuration.
 * @param {string} dirPath Folder path relative to the configured prefix.
 * @returns {string} Blob name.
 */
const getFolderKey = (config, dirPath) => `${getPrefix(config)}${dirPath}/`;
/**
 * Get the name of a blob at the given path.
 * @param {AzureMediaLibrary} config Azure Blob Storage configuration.
 * @param {string} path File path relative to the configured prefix.
 * @returns {string} Blob name.
 */
const getBlobKey = (config, path) => `${getPrefix(config)}${path}`;

/**
 * Get the path of a blob relative to the configured prefix.
 * @param {AzureMediaLibrary} config Azure Blob Storage configuration.
 * @param {string} key Blob name.
 * @returns {string} Path.
 */
const getRelativeKey = (config, key) => {
  const prefix = getPrefix(config);

  return prefix && key.startsWith(prefix) ? key.slice(prefix.length) : key;
};

/**
 * Parse blobs returned by the Blob service into the `ExternalAsset` format.
 * @param {AzureBlob[]} blobs Blobs.
 * @param {AzureMediaLibrary} config Azure Blob Storage configuration.
 * @param {string} token SAS token.
 * @returns {ExternalAsset[]} Assets.
 */
export const parseBlobResults = (blobs, config, token) => {
  const { public_url: publicUrl } = config;
  const containerUrl = buildContainerUrl(config);

  return blobs.map(({ Name: key, Properties: properties = {} }) => {
    const fileName = key.split('/').pop() || key;
    const displayKey = getRelativeKey(config, key);
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
 * Fetch the blobs under the configured prefix from the container, page by page.
 * @param {AzureMediaLibrary} config Azure Blob Storage configuration.
 * @param {MediaLibraryFetchOptions} options Fetch options (`apiKey` contains the SAS token).
 * @param {object} [params] Additional parameters.
 * @param {number} [params.maxPages] Maximum number of pages to fetch. Default: 10.
 * @returns {Promise<{ files: AzureBlob[], folders: string[] }>} Blobs, split into the files and
 * the folder placeholders, the latter given as folder paths relative to the prefix.
 * @see https://learn.microsoft.com/en-us/rest/api/storageservices/list-blobs
 */
const fetchBlobListing = async (config, options, { maxPages = 10 } = {}) => {
  const { apiKey: token } = options;
  const prefix = getPrefix(config);

  if (!token) {
    return Promise.reject(new Error('Azure Blob Storage SAS token is required'));
  }

  const url = buildContainerUrl(config);
  /** @type {AzureBlob[]} */
  const files = [];
  /** @type {string[]} */
  const folders = [];
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

    blobs.forEach((/** @type {AzureBlob} */ item) => {
      // A name ending with a slash is a directory placeholder — one the CMS created for an empty
      // folder, or one a hierarchical namespace account returns — rather than a file
      if (item.Name.endsWith('/')) {
        const dirPath = getRelativeKey(config, item.Name).replace(/\/$/, '');

        // The placeholder of the prefix itself isn’t a folder below it
        if (dirPath) {
          folders.push(dirPath);
        }
      } else {
        files.push(item);
      }
    });

    marker = data.NextMarker || undefined;

    if (!marker) {
      break;
    }

    // Wait for a bit before requesting the next page
    await sleep(50);
  }

  return { files, folders };
};

/**
 * List blobs in the configured container.
 * @param {AzureMediaLibrary} config Azure Blob Storage configuration.
 * @param {MediaLibraryFetchOptions} options Fetch options (`apiKey` contains the SAS token).
 * @param {object} [params] Additional parameters.
 * @param {number} [params.maxPages] Maximum number of pages to fetch. Default: 10.
 * @returns {Promise<ExternalAsset[]>} Assets.
 */
export const listBlobs = async (config, options, params = {}) => {
  const { kind, apiKey: token } = options;
  const { files } = await fetchBlobListing(config, options, params);
  // Filter by kind if specified
  const filteredBlobs = kind ? files.filter(({ Name }) => getAssetKind(Name) === kind) : files;

  return parseBlobResults(filteredBlobs, config, /** @type {string} */ (token));
};

/**
 * List the files and the empty folders under the configured prefix in the container.
 * @param {AzureMediaLibrary} config Azure Blob Storage configuration.
 * @param {MediaLibraryFetchOptions} options Fetch options (`apiKey` contains the SAS token).
 * @returns {Promise<ExternalFolderListing>} Files and folders.
 */
export const browseBlobs = async (config, options) => {
  const { kind, apiKey: token } = options;
  const { files, folders } = await fetchBlobListing(config, options);
  const filteredBlobs = kind ? files.filter(({ Name }) => getAssetKind(Name) === kind) : files;

  return {
    assets: parseBlobResults(filteredBlobs, config, /** @type {string} */ (token)),
    folders,
  };
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

  return filterAssetsByQuery(allAssets, query);
};

/**
 * Upload a single file to the configured container as a block blob under the given name,
 * overwriting any existing blob with the same name.
 * @param {object} params Parameters.
 * @param {string} params.key Blob name.
 * @param {File} params.file File to upload.
 * @param {AzureMediaLibrary} params.config Azure Blob Storage configuration.
 * @param {string} params.token SAS token.
 * @returns {Promise<AzureBlob>} Uploaded blob.
 * @see https://learn.microsoft.com/en-us/rest/api/storageservices/put-blob
 */
export const putBlob = async ({ key, file, config, token }) => {
  const url = `${buildContainerUrl(config)}/${encodeKey(key)}`;
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

  return {
    Name: key,
    Properties: {
      'Last-Modified': new Date().toUTCString(),
      'Content-Length': String(file.size),
      'Content-Type': file.type,
    },
  };
};

/**
 * Upload files to the configured container as block blobs.
 * @param {File[]} files Files to upload.
 * @param {AzureMediaLibrary} config Azure Blob Storage configuration.
 * @param {MediaLibraryFetchOptions} options Fetch options (`apiKey` contains the SAS token).
 * @returns {Promise<ExternalAsset[]>} Uploaded assets.
 */
export const uploadBlobs = async (files, config, options) => {
  if (files.length === 0) {
    return [];
  }

  const { apiKey: token, dirPath = '' } = options;

  if (!token) {
    return Promise.reject(new Error('Azure Blob Storage SAS token is required'));
  }

  /** @type {AzureBlob[]} */
  const uploadedBlobs = [];

  // Upload files one by one
  // eslint-disable-next-line no-restricted-syntax
  for (const file of files) {
    // Extract only the filename to prevent path traversal via crafted File objects
    const sanitizedName = file.name.split(/[/\\]/).filter(Boolean).at(-1) ?? file.name;
    const key = getBlobKey(config, dirPath ? `${dirPath}/${sanitizedName}` : sanitizedName);

    uploadedBlobs.push(await putBlob({ key, file, config, token }));

    // Wait a bit between uploads
    if (files.length > 1) {
      await sleep(50);
    }
  }

  return parseBlobResults(uploadedBlobs, config, token);
};

/**
 * Delete blobs from the configured container. The account’s CORS rules must allow the `DELETE`
 * method, in addition to the `GET` and `PUT` methods needed for listing and uploading; otherwise
 * the browser blocks the request at the preflight stage.
 * @param {ExternalAsset[]} assets Assets to delete. The `id` of each asset is the blob name.
 * @param {AzureMediaLibrary} config Azure Blob Storage configuration.
 * @param {MediaLibraryFetchOptions} options Fetch options (`apiKey` contains the SAS token).
 * @returns {Promise<void>}
 * @see https://learn.microsoft.com/en-us/rest/api/storageservices/delete-blob
 */
export const deleteBlobs = async (assets, config, options) => {
  const { apiKey: token } = options;

  if (!token) {
    return Promise.reject(new Error('Azure Blob Storage SAS token is required'));
  }

  const containerUrl = buildContainerUrl(config);

  // Delete blobs one by one
  // eslint-disable-next-line no-restricted-syntax
  for (const { id: key } of assets) {
    const url = `${containerUrl}/${encodeKey(key)}`;
    const response = await fetch(buildRequestUrl({ url, token }), { method: 'DELETE' });

    if (!response.ok) {
      const errorText = await response.text();

      throw new Error(`Failed to delete blob ${key}: ${errorText}`);
    }

    // Wait a bit between requests
    if (assets.length > 1) {
      await sleep(50);
    }
  }

  return undefined;
};

/**
 * Move a blob in the configured container to another path. The Blob service has no move operation,
 * so the blob is copied to the new name with the synchronous `Put Blob From URL` operation, and
 * then the original is deleted. The account’s CORS rules must allow the `PUT` and `DELETE` methods
 * as well as the `x-ms-copy-source` header, in addition to `x-ms-blob-type`; otherwise the browser
 * blocks the request at the preflight stage.
 * @param {ExternalAsset} asset Asset to move. Its `id` is the blob name.
 * @param {string} newPath New path relative to the configured prefix.
 * @param {AzureMediaLibrary} config Azure Blob Storage configuration.
 * @param {MediaLibraryFetchOptions} options Fetch options (`apiKey` contains the SAS token).
 * @returns {Promise<ExternalAsset>} Moved asset.
 * @see https://learn.microsoft.com/en-us/rest/api/storageservices/put-blob-from-url
 */
export const moveBlob = async (asset, newPath, config, options) => {
  const { apiKey: token } = options;

  if (!token) {
    return Promise.reject(new Error('Azure Blob Storage SAS token is required'));
  }

  const { id: key, size, lastModified } = asset;
  const containerUrl = buildContainerUrl(config);
  const newKey = getBlobKey(config, newPath);
  const url = `${containerUrl}/${encodeKey(newKey)}`;

  const response = await fetch(buildRequestUrl({ url, token }), {
    method: 'PUT',
    headers: {
      'x-ms-blob-type': 'BlockBlob',
      // The source must be readable by the service, so the SAS token is appended
      'x-ms-copy-source': buildRequestUrl({ url: `${containerUrl}/${encodeKey(key)}`, token }),
    },
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(`Failed to copy blob ${key}: ${errorText}`);
  }

  // With a SAS token issued for a service version older than 2020-04-08, the request is handled as
  // an asynchronous `Copy Blob` operation instead. Never remove the source while the copy is still
  // pending, otherwise the copy fails and the file is lost
  if (response.headers.get('x-ms-copy-status') === 'pending') {
    throw new Error(`Failed to copy blob ${key}: the copy operation is still pending`);
  }

  await deleteBlobs([asset], config, options);

  return parseBlobResults(
    [
      {
        Name: newKey,
        Properties: {
          ...(lastModified && { 'Last-Modified': lastModified.toUTCString() }),
          ...(size && { 'Content-Length': String(size) }),
        },
      },
    ],
    config,
    token,
  )[0];
};

/**
 * Rename a blob in the configured container, keeping it in its folder.
 * @param {ExternalAsset} asset Asset to rename. Its `id` is the blob name.
 * @param {string} newName New file name, without a directory.
 * @param {AzureMediaLibrary} config Azure Blob Storage configuration.
 * @param {MediaLibraryFetchOptions} options Fetch options (`apiKey` contains the SAS token).
 * @returns {Promise<ExternalAsset>} Renamed asset.
 */
export const renameBlob = async (asset, newName, config, options) => {
  const dirName = getRelativeKey(config, asset.id).split('/').slice(0, -1).join('/');

  return moveBlob(asset, dirName ? `${dirName}/${newName}` : newName, config, options);
};

/**
 * Create an empty folder in the configured container by putting a zero-byte placeholder blob at
 * the folder name, the way Azure Storage Explorer creates a virtual directory.
 * @param {string} dirPath Folder path relative to the configured prefix.
 * @param {AzureMediaLibrary} config Azure Blob Storage configuration.
 * @param {MediaLibraryFetchOptions} options Fetch options (`apiKey` contains the SAS token).
 * @returns {Promise<void>}
 */
export const createFolder = async (dirPath, config, options) => {
  const { apiKey: token } = options;

  if (!token) {
    return Promise.reject(new Error('Azure Blob Storage SAS token is required'));
  }

  const key = getFolderKey(config, dirPath);
  const url = `${buildContainerUrl(config)}/${encodeKey(key)}`;

  const response = await fetch(buildRequestUrl({ url, token }), {
    method: 'PUT',
    headers: { 'x-ms-blob-type': 'BlockBlob', 'Content-Type': 'application/x-directory' },
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(`Failed to create folder ${key}: ${errorText}`);
  }

  return undefined;
};

/**
 * Remove the placeholder blob of a folder in the configured container. A folder that has no
 * placeholder, because it only ever held files, is as good as removed.
 * @param {string} dirPath Folder path relative to the configured prefix.
 * @param {AzureMediaLibrary} config Azure Blob Storage configuration.
 * @param {MediaLibraryFetchOptions} options Fetch options (`apiKey` contains the SAS token).
 * @returns {Promise<void>}
 */
export const deleteFolder = async (dirPath, config, options) => {
  const { apiKey: token } = options;

  if (!token) {
    return Promise.reject(new Error('Azure Blob Storage SAS token is required'));
  }

  const key = getFolderKey(config, dirPath);
  const url = `${buildContainerUrl(config)}/${encodeKey(key)}`;
  const response = await fetch(buildRequestUrl({ url, token }), { method: 'DELETE' });

  if (!response.ok && response.status !== 404) {
    const errorText = await response.text();

    throw new Error(`Failed to delete folder ${key}: ${errorText}`);
  }

  return undefined;
};

/**
 * Replace a blob in the configured container with a new file, keeping the blob name so that the
 * URL stays the same.
 * @param {ExternalAsset} asset Asset to replace. Its `id` is the blob name.
 * @param {File} file New file.
 * @param {AzureMediaLibrary} config Azure Blob Storage configuration.
 * @param {MediaLibraryFetchOptions} options Fetch options (`apiKey` contains the SAS token).
 * @returns {Promise<ExternalAsset>} Replaced asset.
 */
export const replaceBlob = async (asset, file, config, options) => {
  const { apiKey: token } = options;

  if (!token) {
    return Promise.reject(new Error('Azure Blob Storage SAS token is required'));
  }

  const blob = await putBlob({ key: asset.id, file, config, token });

  return parseBlobResults([blob], config, token)[0];
};

/**
 * List files from Azure Blob Storage.
 * @param {MediaLibraryFetchOptions} options Options containing the configuration.
 * @returns {Promise<ExternalAsset[]>} Assets.
 */
export const list = async (options) => listBlobs(getConfig(options), options);

/**
 * List the files and the empty folders on Azure Blob Storage.
 * @param {MediaLibraryFetchOptions} options Options containing the configuration.
 * @returns {Promise<ExternalFolderListing>} Files and folders.
 */
export const browse = async (options) => browseBlobs(getConfig(options), options);

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
 * Delete files from Azure Blob Storage.
 * @param {ExternalAsset[]} assets Assets to delete.
 * @param {MediaLibraryFetchOptions} options Options containing the configuration.
 * @returns {Promise<void>}
 */
export const deleteFiles = async (assets, options) =>
  deleteBlobs(assets, getConfig(options), options);

/**
 * Rename a file on Azure Blob Storage.
 * @param {ExternalAsset} asset Asset to rename.
 * @param {string} newName New file name.
 * @param {MediaLibraryFetchOptions} options Options containing the configuration.
 * @returns {Promise<ExternalAsset>} Renamed asset.
 */
export const rename = async (asset, newName, options) =>
  renameBlob(asset, newName, getConfig(options), options);

/**
 * Replace a file on Azure Blob Storage with a new file.
 * @param {ExternalAsset} asset Asset to replace.
 * @param {File} file New file.
 * @param {MediaLibraryFetchOptions} options Options containing the configuration.
 * @returns {Promise<ExternalAsset>} Replaced asset.
 */
export const replace = async (asset, file, options) =>
  replaceBlob(asset, file, getConfig(options), options);

/**
 * Move a file on Azure Blob Storage to another path.
 * @param {ExternalAsset} asset Asset to move.
 * @param {string} newPath New path relative to the configured prefix.
 * @param {MediaLibraryFetchOptions} options Options containing the configuration.
 * @returns {Promise<ExternalAsset>} Moved asset.
 */
export const move = async (asset, newPath, options) =>
  moveBlob(asset, newPath, getConfig(options), options);

/**
 * Create an empty folder on Azure Blob Storage.
 * @param {string} dirPath Folder path relative to the configured prefix.
 * @param {MediaLibraryFetchOptions} options Options containing the configuration.
 * @returns {Promise<void>}
 */
export const createEmptyFolder = async (dirPath, options) =>
  createFolder(dirPath, getConfig(options), options);

/**
 * Remove the placeholder of a folder on Azure Blob Storage.
 * @param {string} dirPath Folder path relative to the configured prefix.
 * @param {MediaLibraryFetchOptions} options Options containing the configuration.
 * @returns {Promise<void>}
 */
export const removeFolder = async (dirPath, options) =>
  deleteFolder(dirPath, getConfig(options), options);

/**
 * Whether the given URL points to a blob in the configured container, through either the public
 * URL or the Blob service.
 * @param {string} url URL.
 * @returns {boolean} Result.
 */
export const isAssetURL = (url) => {
  const config = getLibraryOptions();

  if (!config) {
    return false;
  }

  const { public_url: publicUrl } = config;

  return [
    `${buildContainerUrl(config)}/`,
    ...(publicUrl ? [`${trimSlashes(publicUrl)}/`] : []),
  ].some((base) => url.startsWith(base));
};

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
  isAssetURL,
  list,
  browse,
  search,
  upload,
  delete: deleteFiles,
  rename,
  replace,
  move,
  createFolder: createEmptyFolder,
  deleteFolder: removeFolder,
};
