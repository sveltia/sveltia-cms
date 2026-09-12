import {
  deleteS3Objects,
  getLibraryOptions as getS3LibraryOptions,
  isS3ObjectUrl,
  listS3Objects,
  renameS3Object,
  replaceS3Object,
  searchS3Objects,
  uploadToS3,
} from './core';

/**
 * @import {
 * ExternalAsset,
 * MediaLibraryFetchOptions,
 * MediaLibraryService,
 * } from '$lib/types/private';
 * @import { CmsConfig, MediaField, S3MediaLibrary } from '$lib/types/public';
 */

/**
 * Map of Cloudflare R2 jurisdiction identifiers to their endpoint infixes.
 * @type {Record<string, string>}
 * @see https://github.com/sveltia/sveltia-cms/issues/752
 * @see https://developers.cloudflare.com/r2/reference/data-location/#jurisdictional-restrictions
 */
const JURISDICTION_INFIXES = {
  default: '',
  eu: 'eu.',
  fedramp: 'fedramp.',
};

/**
 * Build the Cloudflare R2 S3 API endpoint for the given account and jurisdiction.
 * @param {S3MediaLibrary} libOptions Library options.
 * @returns {string} Endpoint URL.
 */
const getEndpoint = ({ account_id: accountId, jurisdiction = 'default' }) => {
  const infix = JURISDICTION_INFIXES[jurisdiction] ?? '';

  return `https://${accountId}.${infix}r2.cloudflarestorage.com`;
};

/**
 * Get Cloudflare R2 library options from site config.
 * @param {CmsConfig | MediaField} [config] CMS configuration or field configuration.
 * @returns {S3MediaLibrary | false | undefined} Configuration object, or `false` if explicitly
 * disabled.
 */
export const getLibraryOptions = (config) => getS3LibraryOptions('cloudflare_r2', config);

/**
 * Check if Cloudflare R2 integration is enabled.
 * @param {MediaField} [fieldConfig] Field configuration.
 * @returns {boolean} True if enabled, false otherwise.
 */
export const isEnabled = (fieldConfig) => {
  const options = getLibraryOptions(fieldConfig) ?? getLibraryOptions();

  return !!(options && options.access_key_id && options.bucket && options.account_id);
};

/**
 * Build the resolved S3 config for the given field or global R2 library options.
 * @param {MediaLibraryFetchOptions} options Options containing the configuration.
 * @returns {S3MediaLibrary} Resolved config, or throws if unavailable.
 * @throws {Error} If the Cloudflare R2 configuration is not available.
 */
const getConfig = ({ fieldConfig }) => {
  const libOptions = getLibraryOptions(fieldConfig) ?? getLibraryOptions();

  if (!libOptions) {
    throw new Error('Cloudflare R2 configuration is not available');
  }

  // R2 uses auto region
  return {
    ...libOptions,
    region: 'auto',
    endpoint: getEndpoint(libOptions),
  };
};

/**
 * List files from Cloudflare R2.
 * @param {MediaLibraryFetchOptions} options Options containing the configuration.
 * @returns {Promise<ExternalAsset[]>} Assets.
 */
export const list = async (options) => listS3Objects(getConfig(options), options);

/**
 * Search files in Cloudflare R2.
 * @param {string} query Search query.
 * @param {MediaLibraryFetchOptions} options Options containing the configuration.
 * @returns {Promise<ExternalAsset[]>} Assets.
 */
export const search = async (query, options) => searchS3Objects(query, getConfig(options), options);

/**
 * Upload files to Cloudflare R2.
 * @param {File[]} files Files to upload.
 * @param {MediaLibraryFetchOptions} options Options containing the configuration.
 * @returns {Promise<ExternalAsset[]>} Uploaded assets.
 */
export const upload = async (files, options) => uploadToS3(files, getConfig(options), options);

/**
 * Delete files from Cloudflare R2.
 * @param {ExternalAsset[]} assets Assets to delete.
 * @param {MediaLibraryFetchOptions} options Options containing the configuration.
 * @returns {Promise<void>}
 */
export const deleteFiles = async (assets, options) =>
  deleteS3Objects(assets, getConfig(options), options);

/**
 * Rename a file on Cloudflare R2.
 * @param {ExternalAsset} asset Asset to rename.
 * @param {string} newName New file name.
 * @param {MediaLibraryFetchOptions} options Options containing the configuration.
 * @returns {Promise<ExternalAsset>} Renamed asset.
 */
export const rename = async (asset, newName, options) =>
  renameS3Object(asset, newName, getConfig(options), options);

/**
 * Replace a file on Cloudflare R2 with a new file.
 * @param {ExternalAsset} asset Asset to replace.
 * @param {File} file New file.
 * @param {MediaLibraryFetchOptions} options Options containing the configuration.
 * @returns {Promise<ExternalAsset>} Replaced asset.
 */
export const replace = async (asset, file, options) =>
  replaceS3Object(asset, file, getConfig(options), options);

/**
 * Whether the given URL points to a file on Cloudflare R2.
 * @param {string} url URL.
 * @returns {boolean} Result.
 */
export const isAssetURL = (url) => {
  try {
    return isS3ObjectUrl(getConfig(/** @type {any} */ ({})), url);
  } catch {
    // The service is not configured
    return false;
  }
};

/**
 * Cloudflare R2 media library service integration.
 * @type {MediaLibraryService}
 */
export default {
  serviceType: 'cloud_storage',
  serviceId: 'cloudflare_r2',
  serviceLabel: 'Cloudflare R2',
  serviceURL: 'https://www.cloudflare.com/developer-platform/r2/',
  showServiceLink: true,
  hotlinking: true,
  authType: 'api_key',
  developerURL: 'https://developers.cloudflare.com/r2/',
  apiKeyURL: 'https://dash.cloudflare.com/?to=/:account/r2/api-tokens',
  apiKeyPattern: /^[A-Za-z0-9/+=]{40,}$/,
  isEnabled,
  isAssetURL,
  list,
  search,
  upload,
  delete: deleteFiles,
  rename,
  replace,
};
