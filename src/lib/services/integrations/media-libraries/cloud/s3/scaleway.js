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
 * Get Scaleway Object Storage library options from site config.
 * @internal
 * @param {CmsConfig | MediaField} [config] CMS configuration or field configuration.
 * @returns {S3MediaLibrary | false | undefined} Configuration object, or `false` if explicitly
 * disabled.
 */
export const getLibraryOptions = (config) => getS3LibraryOptions('scaleway_object_storage', config);

/**
 * Check if Scaleway Object Storage integration is enabled.
 * @param {MediaField} [fieldConfig] Field configuration.
 * @returns {boolean} True if enabled, false otherwise.
 */
export const isEnabled = (fieldConfig) => {
  const options = getLibraryOptions(fieldConfig) ?? getLibraryOptions();

  return !!(options && options.access_key_id && options.bucket && options.region);
};

/**
 * Build the resolved S3 config for the given field or global Scaleway library options.
 * @param {MediaLibraryFetchOptions} options Options containing the configuration.
 * @returns {S3MediaLibrary} Resolved config.
 * @throws {Error} If the Scaleway Object Storage configuration is not available.
 */
const getConfig = ({ fieldConfig }) => {
  const libOptions = getLibraryOptions(fieldConfig) ?? getLibraryOptions();

  if (!libOptions) {
    throw new Error('Scaleway Object Storage configuration is not available');
  }

  // Scaleway uses the region endpoint for API calls (path-style) and virtual-hosted-style for
  // public asset URLs, unless the user has configured a custom CDN public_url.
  return {
    ...libOptions,
    endpoint: `https://s3.${libOptions.region}.scw.cloud`,
    public_url:
      libOptions.public_url ?? `https://${libOptions.bucket}.s3.${libOptions.region}.scw.cloud`,
  };
};

/**
 * List files from Scaleway Object Storage.
 * @param {MediaLibraryFetchOptions} options Options containing the configuration.
 * @returns {Promise<ExternalAsset[]>} Assets.
 */
export const list = async (options) => listS3Objects(getConfig(options), options);

/**
 * Search files in Scaleway Object Storage.
 * @param {string} query Search query.
 * @param {MediaLibraryFetchOptions} options Options containing the configuration.
 * @returns {Promise<ExternalAsset[]>} Assets.
 */
export const search = async (query, options) => searchS3Objects(query, getConfig(options), options);

/**
 * Upload files to Scaleway Object Storage.
 * @param {File[]} files Files to upload.
 * @param {MediaLibraryFetchOptions} options Options containing the configuration.
 * @returns {Promise<ExternalAsset[]>} Uploaded assets.
 */
export const upload = async (files, options) => uploadToS3(files, getConfig(options), options);

/**
 * Scaleway Object Storage media library service integration.
 * @type {MediaLibraryService}
 */
export default {
  serviceType: 'cloud_storage',
  serviceId: 'scaleway_object_storage',
  serviceLabel: 'Scaleway Object Storage',
  serviceURL: 'https://www.scaleway.com/en/object-storage/',
  showServiceLink: true,
  hotlinking: true,
  authType: 'api_key',
  developerURL: 'https://www.scaleway.com/en/docs/object-storage/',
  apiKeyURL: 'https://console.scaleway.com/iam/api-keys',
  apiKeyPattern: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  isEnabled,
  list,
  search,
  upload,
};
