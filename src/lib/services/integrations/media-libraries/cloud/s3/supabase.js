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
 * Build the Supabase Storage S3 API endpoint for the given project.
 * @param {S3MediaLibrary} libOptions Library options.
 * @returns {string} Endpoint URL.
 * @see https://supabase.com/docs/guides/storage/s3/authentication
 */
const getEndpoint = ({ project_id: projectId }) =>
  `https://${projectId}.storage.supabase.co/storage/v1/s3`;

/**
 * Build the Supabase Storage public base URL for the given project and bucket.
 * @param {S3MediaLibrary} libOptions Library options.
 * @returns {string} Public base URL (bucket included; key is appended by core).
 */
const getPublicUrl = ({ project_id: projectId, bucket }) =>
  `https://${projectId}.supabase.co/storage/v1/object/public/${bucket}`;

/**
 * Get Supabase Storage library options from site config.
 * @internal
 * @param {CmsConfig | MediaField} [config] CMS configuration or field configuration.
 * @returns {S3MediaLibrary | false | undefined} Configuration object, or `false` if explicitly
 * disabled.
 */
export const getLibraryOptions = (config) => getS3LibraryOptions('supabase_storage', config);

/**
 * Check if Supabase Storage integration is enabled.
 * @param {MediaField} [fieldConfig] Field configuration.
 * @returns {boolean} True if enabled, false otherwise.
 */
export const isEnabled = (fieldConfig) => {
  const options = getLibraryOptions(fieldConfig) ?? getLibraryOptions();

  return !!(options && options.access_key_id && options.bucket && options.project_id);
};

/**
 * Build the resolved S3 config for the given field or global Supabase library options.
 * @param {MediaLibraryFetchOptions} options Options containing the configuration.
 * @returns {S3MediaLibrary} Resolved config.
 * @throws {Error} If the Supabase Storage configuration is not available.
 */
const getConfig = ({ fieldConfig }) => {
  const libOptions = getLibraryOptions(fieldConfig) ?? getLibraryOptions();

  if (!libOptions) {
    throw new Error('Supabase Storage configuration is not available');
  }

  return {
    ...libOptions,
    endpoint: getEndpoint(libOptions),
    public_url: libOptions.public_url ?? getPublicUrl(libOptions),
  };
};

/**
 * List files from Supabase Storage.
 * @param {MediaLibraryFetchOptions} options Options containing the configuration.
 * @returns {Promise<ExternalAsset[]>} Assets.
 */
export const list = async (options) => listS3Objects(getConfig(options), options);

/**
 * Search files in Supabase Storage.
 * @param {string} query Search query.
 * @param {MediaLibraryFetchOptions} options Options containing the configuration.
 * @returns {Promise<ExternalAsset[]>} Assets.
 */
export const search = async (query, options) => searchS3Objects(query, getConfig(options), options);

/**
 * Upload files to Supabase Storage.
 * @param {File[]} files Files to upload.
 * @param {MediaLibraryFetchOptions} options Options containing the configuration.
 * @returns {Promise<ExternalAsset[]>} Uploaded assets.
 */
export const upload = async (files, options) => uploadToS3(files, getConfig(options), options);

/**
 * Supabase Storage media library service integration.
 * @type {MediaLibraryService}
 */
export default {
  serviceType: 'cloud_storage',
  serviceId: 'supabase_storage',
  serviceLabel: 'Supabase Storage',
  serviceURL: 'https://supabase.com/storage',
  showServiceLink: true,
  hotlinking: true,
  authType: 'api_key',
  developerURL: 'https://supabase.com/docs/guides/storage',
  apiKeyURL: 'https://supabase.com/dashboard/project/_/storage/settings',
  apiKeyPattern: /^[A-Za-z0-9/+=]{40,}$/,
  isEnabled,
  list,
  search,
  upload,
};
