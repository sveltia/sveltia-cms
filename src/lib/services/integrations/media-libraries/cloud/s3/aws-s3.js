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
 * Get Amazon S3 library options from site config.
 * @internal
 * @param {CmsConfig | MediaField} [config] CMS configuration or field configuration.
 * @returns {S3MediaLibrary | false | undefined} Configuration object, or `false` if explicitly
 * disabled.
 */
export const getLibraryOptions = (config = get(cmsConfig)) =>
  config?.media_libraries?.aws_s3 ??
  (config?.media_library?.name === 'aws_s3'
    ? /** @type {S3MediaLibrary} */ (config?.media_library)
    : undefined);

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
 * List files from Amazon S3.
 * @param {MediaLibraryFetchOptions} options Options containing the configuration.
 * @returns {Promise<ExternalAsset[]>} Assets.
 */
export const list = async (options) => {
  const { fieldConfig } = options;
  const libOptions = getLibraryOptions(fieldConfig) ?? getLibraryOptions();

  if (!libOptions) {
    return Promise.reject(new Error('Amazon S3 configuration is not available'));
  }

  return listS3Objects(libOptions, options);
};

/**
 * Search files in Amazon S3.
 * @param {string} query Search query.
 * @param {MediaLibraryFetchOptions} options Options containing the configuration.
 * @returns {Promise<ExternalAsset[]>} Assets.
 */
export const search = async (query, options) => {
  const { fieldConfig } = options;
  const libOptions = getLibraryOptions(fieldConfig) ?? getLibraryOptions();

  if (!libOptions) {
    return Promise.reject(new Error('Amazon S3 configuration is not available'));
  }

  return searchS3Objects(query, libOptions, options);
};

/**
 * Upload files to Amazon S3.
 * @param {File[]} files Files to upload.
 * @param {MediaLibraryFetchOptions} options Options containing the configuration.
 * @returns {Promise<ExternalAsset[]>} Uploaded assets.
 */
export const upload = async (files, options) => {
  const { fieldConfig } = options;
  const libOptions = getLibraryOptions(fieldConfig) ?? getLibraryOptions();

  if (!libOptions) {
    return Promise.reject(new Error('Amazon S3 configuration is not available'));
  }

  return uploadToS3(files, libOptions, options);
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
  list,
  search,
  upload,
};
