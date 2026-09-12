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
 * Get Amazon S3 library options from site config.
 * @param {CmsConfig | MediaField} [config] CMS configuration or field configuration.
 * @returns {S3MediaLibrary | false | undefined} Configuration object, or `false` if explicitly
 * disabled.
 */
export const getLibraryOptions = (config) => getS3LibraryOptions('aws_s3', config);

/**
 * Check if Amazon S3 integration is enabled.
 * @param {MediaField} [fieldConfig] Field configuration.
 * @returns {boolean} True if enabled, false otherwise.
 */
export const isEnabled = (fieldConfig) => {
  const options = getLibraryOptions(fieldConfig) ?? getLibraryOptions();

  return !!(options && options.access_key_id && options.bucket && options.region);
};

/**
 * Get the resolved library options for the given field or global S3 config.
 * @param {MediaLibraryFetchOptions} options Options containing the configuration.
 * @returns {S3MediaLibrary} Resolved config, or throws if unavailable.
 * @throws {Error} If the Amazon S3 configuration is not available.
 */
const getConfig = ({ fieldConfig }) => {
  const libOptions = getLibraryOptions(fieldConfig) ?? getLibraryOptions();

  if (!libOptions) {
    throw new Error('Amazon S3 configuration is not available');
  }

  return libOptions;
};

/**
 * List files from Amazon S3.
 * @param {MediaLibraryFetchOptions} options Options containing the configuration.
 * @returns {Promise<ExternalAsset[]>} Assets.
 */
export const list = async (options) => listS3Objects(getConfig(options), options);

/**
 * Search files in Amazon S3.
 * @param {string} query Search query.
 * @param {MediaLibraryFetchOptions} options Options containing the configuration.
 * @returns {Promise<ExternalAsset[]>} Assets.
 */
export const search = async (query, options) => searchS3Objects(query, getConfig(options), options);

/**
 * Upload files to Amazon S3.
 * @param {File[]} files Files to upload.
 * @param {MediaLibraryFetchOptions} options Options containing the configuration.
 * @returns {Promise<ExternalAsset[]>} Uploaded assets.
 */
export const upload = async (files, options) => uploadToS3(files, getConfig(options), options);

/**
 * Delete files from Amazon S3.
 * @param {ExternalAsset[]} assets Assets to delete.
 * @param {MediaLibraryFetchOptions} options Options containing the configuration.
 * @returns {Promise<void>}
 */
export const deleteFiles = async (assets, options) =>
  deleteS3Objects(assets, getConfig(options), options);

/**
 * Rename a file on Amazon S3.
 * @param {ExternalAsset} asset Asset to rename.
 * @param {string} newName New file name.
 * @param {MediaLibraryFetchOptions} options Options containing the configuration.
 * @returns {Promise<ExternalAsset>} Renamed asset.
 */
export const rename = async (asset, newName, options) =>
  renameS3Object(asset, newName, getConfig(options), options);

/**
 * Replace a file on Amazon S3 with a new file.
 * @param {ExternalAsset} asset Asset to replace.
 * @param {File} file New file.
 * @param {MediaLibraryFetchOptions} options Options containing the configuration.
 * @returns {Promise<ExternalAsset>} Replaced asset.
 */
export const replace = async (asset, file, options) =>
  replaceS3Object(asset, file, getConfig(options), options);

/**
 * Whether the given URL points to a file on Amazon S3.
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
 * Amazon S3 media library service integration.
 * @type {MediaLibraryService}
 */
export default {
  serviceType: 'cloud_storage',
  serviceId: 'aws_s3',
  serviceLabel: 'Amazon S3',
  serviceURL: 'https://aws.amazon.com/s3/',
  showServiceLink: true,
  hotlinking: true,
  authType: 'api_key',
  developerURL: 'https://docs.aws.amazon.com/s3/',
  apiKeyURL: 'https://console.aws.amazon.com/iam/home#/security_credentials',
  apiKeyPattern: /^[A-Za-z0-9/+=]{40}$/,
  isEnabled,
  isAssetURL,
  list,
  search,
  upload,
  delete: deleteFiles,
  rename,
  replace,
};
