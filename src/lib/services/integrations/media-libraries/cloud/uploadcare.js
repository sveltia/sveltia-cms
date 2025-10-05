/* eslint-disable no-await-in-loop */

import { sleep } from '@sveltia/utils/misc';
import { get } from 'svelte/store';

import { siteConfig } from '$lib/services/config';
import { formatFileName } from '$lib/services/utils/file';

/**
 * @import {
 * ExternalAsset,
 * MediaLibraryFetchOptions,
 * MediaLibraryService,
 * } from '$lib/types/private';
 * @import { MediaField, SiteConfig, UploadcareMediaLibrary } from '$lib/types/public';
 */

/**
 * @typedef {object} UploadcareResource
 * @property {string} uuid File UUID.
 * @property {string} original_filename Original file name.
 * @property {string} original_file_url Original file URL.
 * @property {number} size File size in bytes.
 * @property {string} mime_type MIME type.
 * @property {boolean} is_image Whether the file is an image.
 * @property {boolean} is_ready Whether the file is ready.
 * @property {object | null} content_info Content information with mime, image, video data.
 * @property {string} datetime_uploaded Upload timestamp.
 * @property {string | null} datetime_stored Storage timestamp.
 * @property {string | null} datetime_removed Removal timestamp.
 */

/**
 * @typedef {object} UploadcareListResponse
 * @property {UploadcareResource[]} results List of files.
 * @property {string | null} next Next page URL.
 * @property {number} total Total number of files.
 */

/**
 * Get Uploadcare library options from site config.
 * @internal
 * @param {SiteConfig | MediaField} [config] Site configuration or field configuration.
 * @returns {UploadcareMediaLibrary | undefined} Configuration object.
 */
export const getLibraryOptions = (config = get(siteConfig)) =>
  config?.media_libraries?.uploadcare ??
  (config?.media_library?.name === 'uploadcare'
    ? /** @type {UploadcareMediaLibrary} */ (config?.media_library)
    : undefined);

/**
 * Get Uploadcare public key from library options.
 * @internal
 * @returns {string | undefined} Public key.
 */
export const getPublicKey = () => getLibraryOptions()?.config?.publicKey;
/**
 * Check if Uploadcare integration is enabled.
 * @returns {boolean} True if enabled, false otherwise.
 */
export const isEnabled = () => !!getPublicKey();

/**
 * Parse API results into ExternalAsset format.
 * @internal
 * @param {UploadcareResource[]} results API results.
 * @param {object} [options] Additional options.
 * @param {MediaField} [options.fieldConfig] Field configuration for custom handling.
 * @returns {ExternalAsset[]} Assets.
 * @see https://decapcms.org/docs/uploadcare/#integration-settings
 */
export const parseResults = (results, { fieldConfig } = {}) => {
  const { settings: { autoFilename = false, defaultOperations = undefined } = {} } =
    getLibraryOptions(fieldConfig) ?? getLibraryOptions() ?? {};

  return results.map((result) => {
    const {
      uuid,
      original_filename: fileName,
      original_file_url: url,
      mime_type: mimeType,
      datetime_uploaded: timestamp,
      size,
    } = result;

    const baseURL = `${new URL(url).origin}/${uuid}/`;

    return {
      id: uuid,
      description: fileName,
      previewURL: `${baseURL}-/preview/400x400/`,
      downloadURL: `${baseURL}${defaultOperations ? `-${defaultOperations}` : ''}${autoFilename ? fileName : ''}`,
      fileName,
      lastModified: new Date(timestamp),
      size,
      kind: mimeType.startsWith('image/')
        ? 'image'
        : mimeType.startsWith('video/')
          ? 'video'
          : 'other',
    };
  });
};

/**
 * Fetch files from Uploadcare API with pagination.
 * @internal
 * @param {MediaLibraryFetchOptions} options Options containing the secret key (apiKey) and kind.
 * @param {object} [config] Additional configuration.
 * @param {number} [config.maxPages] Maximum number of pages to fetch. Default: 10.
 * @param {(file: UploadcareResource) => boolean} [config.filter] Optional filter function.
 * @returns {Promise<ExternalAsset[]>} Assets.
 * @see https://uploadcare.com/api-refs/rest-api/v0.7.0/#tag/File/operation/filesList
 */
export const fetchFiles = async (options, { maxPages = 10, filter } = {}) => {
  const publicKey = getPublicKey();

  if (!publicKey) {
    return Promise.reject(new Error('Uploadcare public key is not configured'));
  }

  const { kind, fieldConfig, apiKey: secretKey } = options;

  const headers = {
    Accept: 'application/vnd.uploadcare-v0.7+json',
    Authorization: `Uploadcare.Simple ${publicKey}:${secretKey}`,
  };

  const params = new URLSearchParams({
    limit: '100',
    ordering: '-datetime_uploaded',
    stored: 'true',
  });

  /** @type {UploadcareResource[]} */
  const allResults = [];
  /** @type {string | null} */
  let nextUrl = `https://api.uploadcare.com/files/?${params}`;

  // Fetch up to maxPages pages
  for (let page = 0; page < maxPages && nextUrl; page += 1) {
    const response = await fetch(nextUrl, { headers });

    if (!response.ok) {
      return Promise.reject(new Error(`Failed to fetch files: ${response.statusText}`));
    }

    /** @type {UploadcareListResponse} */
    const data = await response.json();
    // Apply filters: first kind filter if specified, then custom filter if provided
    let { results } = data;

    if (kind === 'image') {
      results = results.filter((file) => file.is_image);
    }

    if (filter) {
      results = results.filter(filter);
    }

    allResults.push(...results);
    nextUrl = data.next;

    if (!nextUrl) {
      break;
    }

    // Wait for a bit before requesting the next page
    await sleep(50);
  }

  return parseResults(allResults, { fieldConfig });
};

/**
 * List files from Uploadcare.
 * @param {MediaLibraryFetchOptions} options Options containing the secret key (apiKey).
 * @returns {Promise<ExternalAsset[]>} Assets.
 */
export const list = async (options) => fetchFiles(options);

/**
 * Search files in Uploadcare. Since Uploadcare doesn't have a built-in search API,
 * this implementation fetches files and filters them client-side by filename.
 * @param {string} query Search query.
 * @param {MediaLibraryFetchOptions} options Options containing the secret key (apiKey).
 * @returns {Promise<ExternalAsset[]>} Assets.
 */
export const search = async (query, options) => {
  const lowerQuery = query.toLowerCase();
  /**
   * Filter files by filename.
   * @param {UploadcareResource} file File to check.
   * @returns {boolean} Whether the file matches the query.
   */
  const filter = (file) => file.original_filename.toLowerCase().includes(lowerQuery);

  return fetchFiles(options, { filter });
};

/**
 * Generate a secure signature for Uploadcare upload.
 * @internal
 * @param {string} secretKey Secret key.
 * @param {number} expire Expiration timestamp.
 * @returns {Promise<string>} Signature.
 * @see https://uploadcare.com/docs/security/secure-uploads/
 */
export const generateSignature = async (secretKey, expire) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(String(expire));
  const key = encoder.encode(secretKey);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);
  const hashArray = Array.from(new Uint8Array(signature));

  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Upload files to Uploadcare.
 * @param {File[]} files Files to upload.
 * @param {MediaLibraryFetchOptions} options Options containing the secret key (apiKey).
 * @returns {Promise<ExternalAsset[]>} Uploaded assets.
 * @see https://uploadcare.com/api-refs/upload-api/#tag/Upload/operation/baseUpload
 * @see https://uploadcare.com/docs/security/secure-uploads/
 */
export const upload = async (files, options) => {
  if (files.length === 0) {
    return [];
  }

  const publicKey = getPublicKey();

  if (!publicKey) {
    return Promise.reject(new Error('Uploadcare public key is not configured'));
  }

  const { fieldConfig, apiKey: secretKey } = options;

  if (!secretKey) {
    return Promise.reject(new Error('Uploadcare secret key is not provided'));
  }

  // Generate signature for secure upload (expires in 30 minutes)
  const expire = Math.floor(Date.now() / 1000) + 1800;
  const signature = await generateSignature(secretKey, expire);
  // Create a single FormData with all files
  const formData = new FormData();

  formData.append('UPLOADCARE_PUB_KEY', publicKey);
  formData.append('UPLOADCARE_STORE', '1');
  formData.append('signature', signature);
  formData.append('expire', String(expire));

  // Add all files to the same FormData
  files.forEach((file) => {
    formData.append(formatFileName(file.name), file);
  });

  const response = await fetch('https://upload.uploadcare.com/base/', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Failed to upload files: ${response.statusText}`);
  }

  const data = await response.json();

  // Handle both single and multiple file responses
  const uploadedFiles = Object.entries(data)
    .filter(([key]) => !key.startsWith('UPLOADCARE_'))
    .map(([fileName, uuid]) => {
      const file = files.find((f) => f.name === fileName);
      const mimeType = file?.type || 'application/octet-stream';
      const isImage = mimeType.startsWith('image/');

      return {
        uuid,
        original_filename: fileName,
        original_file_url: `https://ucarecdn.com/${uuid}/${fileName}`,
        size: file?.size || 0,
        mime_type: mimeType,
        is_image: isImage,
        is_ready: true,
        content_info: null,
        datetime_uploaded: new Date().toISOString(),
        datetime_stored: new Date().toISOString(),
        datetime_removed: null,
      };
    });

  return parseResults(uploadedFiles, { fieldConfig });
};

/**
 * @type {MediaLibraryService}
 */
export default {
  serviceType: 'cloud_storage',
  serviceId: 'uploadcare',
  serviceLabel: 'Uploadcare',
  serviceURL: 'https://uploadcare.com/',
  showServiceLink: true,
  hotlinking: true,
  authType: 'api_key',
  developerURL: 'https://uploadcare.com/docs/',
  apiKeyURL: 'https://app.uploadcare.com/projects/-/api-keys/',
  apiKeyPattern: /^[a-f0-9]{20}$/,
  isEnabled,
  list,
  search,
  upload,
};
