import { get } from 'svelte/store';

import { cmsConfig } from '$lib/services/config';

import { listS3Objects, searchS3Objects, uploadToS3 } from './core';

/**
 * @import {
 * ExternalAsset,
 * MediaLibraryFetchOptions,
 * MediaLibraryService,
 * } from '$lib/types/private';
 * @import { CmsConfig, MediaField, S3MediaLibrary } from '$lib/types/public';
 */

/**
 * Get Cloudflare R2 library options from site config.
 * @internal
 * @param {CmsConfig | MediaField} [config] CMS configuration or field configuration.
 * @returns {S3MediaLibrary | false | undefined} Configuration object, or `false` if explicitly
 * disabled.
 */
export const getLibraryOptions = (config = get(cmsConfig)) =>
  config?.media_libraries?.cloudflare_r2 ??
  (config?.media_library?.name === 'cloudflare_r2'
    ? /** @type {S3MediaLibrary} */ (config?.media_library)
    : undefined);

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
 * List files from Cloudflare R2.
 * @param {MediaLibraryFetchOptions} options Options containing the configuration.
 * @returns {Promise<ExternalAsset[]>} Assets.
 */
export const list = async (options) => {
  const { fieldConfig } = options;
  const libOptions = getLibraryOptions(fieldConfig) ?? getLibraryOptions();

  if (!libOptions) {
    return Promise.reject(new Error('Cloudflare R2 configuration is not available'));
  }

  // R2 uses auto region
  const config = {
    ...libOptions,
    region: 'auto',
    endpoint: `https://${libOptions.account_id}.r2.cloudflarestorage.com`,
  };

  return listS3Objects(config, options);
};

/**
 * Search files in Cloudflare R2.
 * @param {string} query Search query.
 * @param {MediaLibraryFetchOptions} options Options containing the configuration.
 * @returns {Promise<ExternalAsset[]>} Assets.
 */
export const search = async (query, options) => {
  const { fieldConfig } = options;
  const libOptions = getLibraryOptions(fieldConfig) ?? getLibraryOptions();

  if (!libOptions) {
    return Promise.reject(new Error('Cloudflare R2 configuration is not available'));
  }

  // R2 uses auto region
  const config = {
    ...libOptions,
    region: 'auto',
    endpoint: `https://${libOptions.account_id}.r2.cloudflarestorage.com`,
  };

  return searchS3Objects(query, config, options);
};

/**
 * Upload files to Cloudflare R2.
 * @param {File[]} files Files to upload.
 * @param {MediaLibraryFetchOptions} options Options containing the configuration.
 * @returns {Promise<ExternalAsset[]>} Uploaded assets.
 */
export const upload = async (files, options) => {
  const { fieldConfig } = options;
  const libOptions = getLibraryOptions(fieldConfig) ?? getLibraryOptions();

  if (!libOptions) {
    return Promise.reject(new Error('Cloudflare R2 configuration is not available'));
  }

  // R2 uses auto region
  const config = {
    ...libOptions,
    region: 'auto',
    endpoint: `https://${libOptions.account_id}.r2.cloudflarestorage.com`,
  };

  return uploadToS3(files, config, options);
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
  list,
  search,
  upload,
};
