import {
  getLibraryOptions as getS3LibraryOptions,
  listS3Objects,
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
 * @internal
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
  list,
  search,
  upload,
};
