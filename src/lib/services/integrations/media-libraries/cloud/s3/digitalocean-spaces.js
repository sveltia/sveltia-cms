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
 * Get DigitalOcean Spaces library options from site config.
 * @internal
 * @param {CmsConfig | MediaField} [config] CMS configuration or field configuration.
 * @returns {S3MediaLibrary | false | undefined} Configuration object, or `false` if explicitly
 * disabled.
 */
export const getLibraryOptions = (config) => getS3LibraryOptions('digitalocean_spaces', config);

/**
 * Check if DigitalOcean Spaces integration is enabled.
 * @param {MediaField} [fieldConfig] Field configuration.
 * @returns {boolean} True if enabled, false otherwise.
 */
export const isEnabled = (fieldConfig) => {
  const options = getLibraryOptions(fieldConfig) ?? getLibraryOptions();

  return !!(options && options.access_key_id && options.bucket && options.region);
};

/**
 * Build the resolved S3 config for the given field or global Spaces library options.
 * @param {MediaLibraryFetchOptions} options Options containing the configuration.
 * @returns {S3MediaLibrary} Resolved config, or throws if unavailable.
 * @throws {Error} If the DigitalOcean Spaces configuration is not available.
 */
const getConfig = ({ fieldConfig }) => {
  const libOptions = getLibraryOptions(fieldConfig) ?? getLibraryOptions();

  if (!libOptions) {
    throw new Error('DigitalOcean Spaces configuration is not available');
  }

  // Spaces uses the region endpoint for API calls (path-style) and virtual-hosted-style for
  // public asset URLs, unless the user has configured a custom CDN public_url.
  return {
    ...libOptions,
    endpoint: `https://${libOptions.region}.digitaloceanspaces.com`,
    public_url:
      libOptions.public_url ??
      `https://${libOptions.bucket}.${libOptions.region}.digitaloceanspaces.com`,
  };
};

/**
 * List files from DigitalOcean Spaces.
 * @param {MediaLibraryFetchOptions} options Options containing the configuration.
 * @returns {Promise<ExternalAsset[]>} Assets.
 */
export const list = async (options) => listS3Objects(getConfig(options), options);

/**
 * Search files in DigitalOcean Spaces.
 * @param {string} query Search query.
 * @param {MediaLibraryFetchOptions} options Options containing the configuration.
 * @returns {Promise<ExternalAsset[]>} Assets.
 */
export const search = async (query, options) => searchS3Objects(query, getConfig(options), options);

/**
 * Upload files to DigitalOcean Spaces.
 * @param {File[]} files Files to upload.
 * @param {MediaLibraryFetchOptions} options Options containing the configuration.
 * @returns {Promise<ExternalAsset[]>} Uploaded assets.
 */
export const upload = async (files, options) => uploadToS3(files, getConfig(options), options);

/**
 * DigitalOcean Spaces media library service integration.
 * @type {MediaLibraryService}
 */
export default {
  serviceType: 'cloud_storage',
  serviceId: 'digitalocean_spaces',
  serviceLabel: 'DigitalOcean Spaces',
  serviceURL: 'https://www.digitalocean.com/products/spaces',
  showServiceLink: true,
  hotlinking: true,
  authType: 'api_key',
  developerURL: 'https://docs.digitalocean.com/products/spaces/',
  apiKeyURL: 'https://cloud.digitalocean.com/account/api/spaces',
  apiKeyPattern: /^[A-Za-z0-9/+=]{43}$/,
  isEnabled,
  list,
  search,
  upload,
};
