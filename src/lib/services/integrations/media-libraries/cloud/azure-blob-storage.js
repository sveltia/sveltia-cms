import { getAssetKind } from '$lib/services/assets/kinds';
import {
  encodeKey,
  getFileKey,
  getFolderKey,
  getRelativeKey,
} from '$lib/services/integrations/media-libraries/cloud/shared/keys';
import {
  browseObjects,
  deleteObjects,
  getRenamedPath,
  listObjects,
  replaceObject,
  searchObjects,
  uploadObjects,
} from '$lib/services/integrations/media-libraries/cloud/shared/object-storage';
import { ObjectStorageService } from '$lib/services/integrations/media-libraries/cloud/shared/service';
import { parseXml, toArray } from '$lib/services/utils/xml';

/**
 * @import {
 * ExternalAsset,
 * ExternalFolderListing,
 * MediaLibraryFetchOptions,
 * } from '$lib/types/private';
 * @import { AzureMediaLibrary, CmsConfig, MediaField } from '$lib/types/public';
 * @import {
 * ObjectStorageProvider,
 * } from '$lib/services/integrations/media-libraries/cloud/shared/object-storage';
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
 * Remove any trailing slashes from the given URL.
 * @param {string} url URL.
 * @returns {string} Trimmed URL.
 */
const trimSlashes = (url) => url.replace(/\/+$/, '');

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
 * Build the Blob service URL of a blob, with the SAS token appended.
 * @param {AzureMediaLibrary} config Azure Blob Storage configuration.
 * @param {string} key Blob name.
 * @param {string} token SAS token.
 * @returns {string} Authorized blob URL.
 */
const buildBlobRequestUrl = (config, key, token) =>
  buildRequestUrl({ url: `${buildContainerUrl(config)}/${encodeKey(key)}`, token });

/**
 * Get the SAS token from the given fetch options.
 * @param {MediaLibraryFetchOptions} options Fetch options.
 * @returns {string} SAS token.
 * @throws {Error} When no token was provided.
 */
const requireToken = ({ apiKey: token }) => {
  if (!token) {
    throw new Error('Azure Blob Storage SAS token is required');
  }

  return token;
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
 * Fetch a page of the blobs under the given prefix from the container. A name ending with a slash
 * is a directory placeholder — one the CMS created for an empty folder, or one a hierarchical
 * namespace account returns — rather than a file.
 * @param {object} params Parameters.
 * @param {AzureMediaLibrary} params.config Azure Blob Storage configuration.
 * @param {string} params.credential SAS token.
 * @param {string} params.prefix Blob name prefix.
 * @param {string} [params.cursor] Continuation marker of the page.
 * @returns {Promise<{ items: AzureBlob[], cursor?: string }>} Blobs and the continuation marker of
 * the next page, if any.
 * @see https://learn.microsoft.com/en-us/rest/api/storageservices/list-blobs
 */
const listBlobPage = async ({ config, credential: token, prefix, cursor: marker }) => {
  const searchParams = new URLSearchParams({
    restype: 'container',
    comp: 'list',
    maxresults: String(MAX_RESULTS),
    ...(prefix && { prefix }),
    ...(marker && { marker }),
  });

  const url = buildContainerUrl(config);
  const response = await fetch(buildRequestUrl({ url, token, searchParams }));

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(`Failed to list blobs: ${errorText}`);
  }

  /** @type {any} */
  const data = parseXml(await response.text());

  return { items: toArray(data.Blobs?.Blob), cursor: data.NextMarker || undefined };
};

/**
 * Upload a single file to the configured container as a block blob under the given name,
 * overwriting any existing blob with the same name.
 * @param {object} params Parameters.
 * @param {string} params.key Blob name.
 * @param {File} params.file File to upload.
 * @param {AzureMediaLibrary} params.config Azure Blob Storage configuration.
 * @param {string} params.credential SAS token.
 * @returns {Promise<AzureBlob>} Uploaded blob.
 * @see https://learn.microsoft.com/en-us/rest/api/storageservices/put-blob
 */
const putBlob = async ({ key, file, config, credential: token }) => {
  const fileContent = await file.arrayBuffer();

  const response = await fetch(buildBlobRequestUrl(config, key, token), {
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
 * Delete a single blob from the configured container.
 * @param {object} params Parameters.
 * @param {string} params.key Blob name.
 * @param {AzureMediaLibrary} params.config Azure Blob Storage configuration.
 * @param {string} params.credential SAS token.
 * @returns {Promise<void>}
 * @see https://learn.microsoft.com/en-us/rest/api/storageservices/delete-blob
 */
const deleteBlob = async ({ key, config, credential: token }) => {
  const response = await fetch(buildBlobRequestUrl(config, key, token), { method: 'DELETE' });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(`Failed to delete blob ${key}: ${errorText}`);
  }
};

/**
 * Blob service calls for the operations shared with the other object storage services.
 * @type {ObjectStorageProvider<AzureBlob, AzureMediaLibrary>}
 */
const provider = {
  requireCredential: requireToken,
  listPage: listBlobPage,
  /**
   * Get the name of a blob.
   * @param {AzureBlob} blob Blob.
   * @returns {string} Blob name.
   */
  getKey: ({ Name }) => Name,
  parseResults: parseBlobResults,
  putObject: putBlob,
  deleteObject: deleteBlob,
};

/**
 * List blobs in the configured container.
 * @param {AzureMediaLibrary} config Azure Blob Storage configuration.
 * @param {MediaLibraryFetchOptions} options Fetch options (`apiKey` contains the SAS token).
 * @param {object} [params] Additional parameters.
 * @param {number} [params.maxPages] Maximum number of pages to fetch. Default: 10.
 * @returns {Promise<ExternalAsset[]>} Assets.
 */
export const listBlobs = async (config, options, params = {}) =>
  listObjects(provider, config, options, params);

/**
 * List the files and the empty folders under the configured prefix in the container.
 * @param {AzureMediaLibrary} config Azure Blob Storage configuration.
 * @param {MediaLibraryFetchOptions} options Fetch options (`apiKey` contains the SAS token).
 * @returns {Promise<ExternalFolderListing>} Files and folders.
 */
export const browseBlobs = async (config, options) => browseObjects(provider, config, options);

/**
 * Search blobs in the configured container.
 * @param {string} query Search query.
 * @param {AzureMediaLibrary} config Azure Blob Storage configuration.
 * @param {MediaLibraryFetchOptions} options Fetch options (`apiKey` contains the SAS token).
 * @returns {Promise<ExternalAsset[]>} Assets.
 */
export const searchBlobs = async (query, config, options) =>
  searchObjects(provider, query, config, options);

/**
 * Upload files to the configured container as block blobs.
 * @param {File[]} files Files to upload.
 * @param {AzureMediaLibrary} config Azure Blob Storage configuration.
 * @param {MediaLibraryFetchOptions} options Fetch options (`apiKey` contains the SAS token).
 * @returns {Promise<ExternalAsset[]>} Uploaded assets.
 */
export const uploadBlobs = async (files, config, options) =>
  uploadObjects(provider, files, config, options);

/**
 * Delete blobs from the configured container. The account’s CORS rules must allow the `DELETE`
 * method, in addition to the `GET` and `PUT` methods needed for listing and uploading; otherwise
 * the browser blocks the request at the preflight stage.
 * @param {ExternalAsset[]} assets Assets to delete. The `id` of each asset is the blob name.
 * @param {AzureMediaLibrary} config Azure Blob Storage configuration.
 * @param {MediaLibraryFetchOptions} options Fetch options (`apiKey` contains the SAS token).
 * @returns {Promise<void>}
 */
export const deleteBlobs = async (assets, config, options) =>
  deleteObjects(provider, assets, config, options);

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
  const token = requireToken(options);
  const { id: key, size, lastModified } = asset;
  const newKey = getFileKey(config, newPath);

  const response = await fetch(buildBlobRequestUrl(config, newKey, token), {
    method: 'PUT',
    headers: {
      'x-ms-blob-type': 'BlockBlob',
      // The source must be readable by the service, so the SAS token is appended
      'x-ms-copy-source': buildBlobRequestUrl(config, key, token),
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

  await deleteBlob({ key, config, credential: token });

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
export const renameBlob = async (asset, newName, config, options) =>
  moveBlob(asset, getRenamedPath(config, asset, newName), config, options);

/**
 * Create an empty folder in the configured container by putting a zero-byte placeholder blob at
 * the folder name, the way Azure Storage Explorer creates a virtual directory.
 * @param {string} dirPath Folder path relative to the configured prefix.
 * @param {AzureMediaLibrary} config Azure Blob Storage configuration.
 * @param {MediaLibraryFetchOptions} options Fetch options (`apiKey` contains the SAS token).
 * @returns {Promise<void>}
 */
export const createFolder = async (dirPath, config, options) => {
  const token = requireToken(options);
  const key = getFolderKey(config, dirPath);

  const response = await fetch(buildBlobRequestUrl(config, key, token), {
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
  const token = requireToken(options);
  const key = getFolderKey(config, dirPath);
  const response = await fetch(buildBlobRequestUrl(config, key, token), { method: 'DELETE' });

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
export const replaceBlob = async (asset, file, config, options) =>
  replaceObject(provider, asset, file, config, options);

/**
 * Whether the given URL points to a blob in the configured container, through either the public
 * URL or the Blob service.
 * @param {AzureMediaLibrary} config Azure Blob Storage configuration.
 * @param {string} url URL.
 * @returns {boolean} Result.
 */
const isBlobUrl = (config, url) => {
  const { public_url: publicUrl } = config;

  return [
    `${buildContainerUrl(config)}/`,
    ...(publicUrl ? [`${trimSlashes(publicUrl)}/`] : []),
  ].some((base) => url.startsWith(base));
};

/**
 * Azure Blob Storage media library service integration.
 * @type {ObjectStorageService<AzureMediaLibrary>}
 */
const azureBlobStorage = new ObjectStorageService({
  serviceId: 'azure_blob_storage',
  serviceLabel: 'Azure Blob Storage',
  serviceURL: 'https://azure.microsoft.com/products/storage/blobs/',
  developerURL: 'https://learn.microsoft.com/en-us/rest/api/storageservices/blob-service-rest-api',
  apiKeyURL: 'https://portal.azure.com/#browse/Microsoft.Storage%2FStorageAccounts',
  apiKeyPattern: /^\??(?:[\w-]+=[^&]*&)*sig=[^&]+(?:&[\w-]+=[^&]*)*$/,
  /**
   * Check if the container and either the account name or a custom endpoint are set.
   * @param {AzureMediaLibrary} config Azure Blob Storage configuration.
   * @returns {boolean} Result.
   */
  isConfigured: ({ container, account_name: accountName, endpoint }) =>
    !!(container && (accountName || endpoint)),
  isConfigURL: isBlobUrl,
  operations: {
    list: listBlobs,
    browse: browseBlobs,
    search: searchBlobs,
    upload: uploadBlobs,
    delete: deleteBlobs,
    rename: renameBlob,
    replace: replaceBlob,
    move: moveBlob,
    createFolder,
    deleteFolder,
  },
});

/**
 * Get Azure Blob Storage library options from site config.
 * @param {CmsConfig | MediaField} [config] CMS configuration or field configuration.
 * @returns {AzureMediaLibrary | false | undefined} Configuration object, or `false` if explicitly
 * disabled.
 */
export const getLibraryOptions = (config) => azureBlobStorage.getLibraryOptions(config);

export const {
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
} = azureBlobStorage;

export default azureBlobStorage;
