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
 * S3Config,
 * } from '$lib/types/private';
 * @import { CmsConfig, MediaField, S3MediaLibrary } from '$lib/types/public';
 */

/**
 * Get Backblaze B2 library options from site config.
 * @internal
 * @param {CmsConfig | MediaField} [config] CMS configuration or field configuration.
 * @returns {S3MediaLibrary | false | undefined} Configuration object, or `false` if explicitly
 * disabled.
 */
export const getLibraryOptions = (config) => getS3LibraryOptions('backblaze_b2', config);

/**
 * Check if Backblaze B2 integration is enabled.
 * @param {MediaField} [fieldConfig] Field configuration.
 * @returns {boolean} True if enabled, false otherwise.
 */
export const isEnabled = (fieldConfig) => {
  const options = getLibraryOptions(fieldConfig) ?? getLibraryOptions();

  return !!(options && options.access_key_id && options.bucket && options.region);
};

/**
 * Build the resolved S3 config for the given field or global B2 library options.
 * @param {MediaLibraryFetchOptions} options Options containing the configuration.
 * @returns {S3Config} Resolved config.
 * @throws {Error} If the Backblaze B2 configuration is not available.
 */
const getConfig = ({ fieldConfig }) => {
  const libOptions = getLibraryOptions(fieldConfig) ?? getLibraryOptions();

  if (!libOptions) {
    throw new Error('Backblaze B2 configuration is not available');
  }

  // B2 uses the region endpoint for API calls (path-style) and virtual-hosted-style for public
  // asset URLs, unless the user has configured a custom CDN `public_url`. B2 does not support
  // per-object ACLs; omit the `x-amz-acl` header on uploads.
  return {
    ...libOptions,
    endpoint: `https://s3.${libOptions.region}.backblazeb2.com`,
    acl: false,
    public_url:
      libOptions.public_url ??
      `https://${libOptions.bucket}.s3.${libOptions.region}.backblazeb2.com`,
  };
};

/**
 * List files from Backblaze B2.
 * @param {MediaLibraryFetchOptions} options Options containing the configuration.
 * @returns {Promise<ExternalAsset[]>} Assets.
 */
export const list = async (options) => listS3Objects(getConfig(options), options);

/**
 * Search files in Backblaze B2.
 * @param {string} query Search query.
 * @param {MediaLibraryFetchOptions} options Options containing the configuration.
 * @returns {Promise<ExternalAsset[]>} Assets.
 */
export const search = async (query, options) => searchS3Objects(query, getConfig(options), options);

/**
 * Upload files to Backblaze B2.
 * @param {File[]} files Files to upload.
 * @param {MediaLibraryFetchOptions} options Options containing the configuration.
 * @returns {Promise<ExternalAsset[]>} Uploaded assets.
 */
export const upload = async (files, options) => uploadToS3(files, getConfig(options), options);

/**
 * Backblaze B2 media library service integration.
 * @type {MediaLibraryService}
 */
export default {
  serviceType: 'cloud_storage',
  serviceId: 'backblaze_b2',
  serviceLabel: 'Backblaze B2',
  serviceURL: 'https://www.backblaze.com/cloud-storage',
  showServiceLink: true,
  hotlinking: true,
  authType: 'api_key',
  developerURL: 'https://www.backblaze.com/docs/cloud-storage-s3-compatible-api',
  apiKeyURL: 'https://secure.backblaze.com/app_keys.htm',
  apiKeyPattern: /^[A-Za-z0-9/+=]{30,}$/,
  isEnabled,
  list,
  search,
  upload,
};
