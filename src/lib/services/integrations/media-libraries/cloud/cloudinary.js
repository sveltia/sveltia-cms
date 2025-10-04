/* eslint-disable no-await-in-loop */

import { sleep } from '@sveltia/utils/misc';
import { get } from 'svelte/store';

import { siteConfig } from '$lib/services/config';

/**
 * @import {
 * ExternalAsset,
 * MediaLibraryFetchOptions,
 * MediaLibraryService,
 * } from '$lib/types/private';
 * @import { CloudinaryMediaLibrary } from '$lib/types/public';
 */

/**
 * @typedef {object} CloudinaryResource
 * @property {string} public_id Public ID.
 * @property {string} format File format/extension.
 * @property {string} resource_type Resource type (image, video, raw).
 * @property {string} type Upload type.
 * @property {string} secure_url Secure URL.
 * @property {number} bytes File size in bytes.
 * @property {string} created_at Creation timestamp.
 * @property {number} [width] Image width in pixels.
 * @property {number} [height] Image height in pixels.
 */

/**
 * @typedef {object} CloudinaryListResponse
 * @property {CloudinaryResource[]} resources List of resources.
 * @property {string} [next_cursor] Next page cursor.
 * @property {number} rate_limit_allowed Rate limit allowed.
 * @property {number} rate_limit_remaining Rate limit remaining.
 * @property {number} rate_limit_reset_at Rate limit reset timestamp.
 */

/**
 * Get Cloudinary configuration from site config.
 * @returns {{ cloudName?: string; apiKey?: string }} Cloudinary configuration.
 */
export const getCloudConfig = () => {
  const config = get(siteConfig);

  // New config structure
  if (config?.media_libraries?.cloudinary) {
    const { cloud_name: cloudName, api_key: apiKey } =
      config.media_libraries.cloudinary.config ?? {};

    return { cloudName, apiKey };
  }

  // Fallback to old config structure
  if (config?.media_library?.name === 'cloudinary') {
    const { cloud_name: cloudName, api_key: apiKey } =
      /** @type {CloudinaryMediaLibrary} */ (config.media_library).config ?? {};

    return { cloudName, apiKey };
  }

  return {};
};

/**
 * Parse API results into ExternalAsset format.
 * @param {CloudinaryResource[]} resources API resources.
 * @returns {ExternalAsset[]} Assets.
 */
export const parseResults = (resources) =>
  resources.map(({ public_id: publicId, format, resource_type: resourceType, secure_url: url }) => {
    const fileName = `${publicId}.${format}`;
    const kind = resourceType === 'image' ? 'image' : resourceType === 'video' ? 'video' : 'other';
    // For images, use Cloudinary's transformation API for thumbnails
    const previewURL = kind === 'image' ? url.replace('/upload/', '/upload/w_400,c_limit/') : url;

    return {
      id: publicId,
      description: fileName,
      previewURL,
      downloadURL: url,
      fileName,
      kind,
    };
  });

/**
 * Generate Basic Auth header for Cloudinary API.
 * @param {string} apiKey API key.
 * @param {string} apiSecret API secret.
 * @returns {string} Basic Auth header value.
 */
const generateAuthHeader = (apiKey, apiSecret) => {
  const credentials = `${apiKey}:${apiSecret}`;
  const encoded = btoa(credentials);

  return `Basic ${encoded}`;
};

/**
 * Fetch resources from Cloudinary API with pagination.
 * @param {MediaLibraryFetchOptions} options Options containing the API secret (apiKey).
 * @param {object} [config] Additional configuration.
 * @param {number} [config.maxPages] Maximum number of pages to fetch. Default: 10.
 * @param {string} [config.expression] Search expression for filtering.
 * @returns {Promise<ExternalAsset[]>} Assets.
 */
const fetchResources = async (options, { maxPages = 10, expression } = {}) => {
  const { cloudName, apiKey } = getCloudConfig();

  if (!cloudName) {
    return Promise.reject(new Error('Cloudinary cloud name is not configured'));
  }

  if (!apiKey) {
    return Promise.reject(new Error('Cloudinary API key is not configured'));
  }

  const { apiKey: apiSecret, kind } = options;

  if (!apiSecret) {
    return Promise.reject(new Error('Cloudinary API secret is not provided'));
  }

  const authHeader = generateAuthHeader(apiKey, apiSecret);
  const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/resources/search`;

  const headers = {
    'Content-Type': 'application/json',
    Authorization: authHeader,
  };

  /** @type {CloudinaryResource[]} */
  const allResources = [];
  /** @type {string | undefined} */
  let nextCursor;

  // Fetch up to maxPages pages
  for (let page = 0; page < maxPages; page += 1) {
    // Build expression with kind filter if specified
    let filterExpression = expression;

    if (kind === 'image' && !expression) {
      filterExpression = 'resource_type:image';
    } else if (kind === 'image' && expression) {
      filterExpression = `(${expression}) AND resource_type:image`;
    }

    const body = {
      max_results: 100,
      ...(filterExpression && { expression: filterExpression }),
      ...(nextCursor && { next_cursor: nextCursor }),
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();

      return Promise.reject(new Error(`Failed to fetch resources: ${errorText}`));
    }

    /** @type {CloudinaryListResponse} */
    const data = await response.json();

    allResources.push(...data.resources);
    nextCursor = data.next_cursor;

    if (!nextCursor) {
      break;
    }

    // Wait for a bit before requesting the next page
    await sleep(50);
  }

  return parseResults(allResources);
};

/**
 * List resources from Cloudinary.
 * @param {MediaLibraryFetchOptions} options Options containing the API secret (apiKey).
 * @returns {Promise<ExternalAsset[]>} Assets.
 * @see https://cloudinary.com/documentation/search_api
 */
export const list = async (options) => fetchResources(options);

/**
 * Search resources in Cloudinary using the Search API.
 * @param {string} query Search query.
 * @param {MediaLibraryFetchOptions} options Options containing the API secret (apiKey).
 * @returns {Promise<ExternalAsset[]>} Assets.
 * @see https://cloudinary.com/documentation/search_api
 */
export const search = async (query, options) => {
  // Build a search expression that searches in public_id and filename
  const expression = `public_id:*${query}* OR filename:*${query}*`;

  return fetchResources(options, { expression });
};

/**
 * Generate signature for Cloudinary upload.
 * @param {Record<string, string | number>} params Parameters to sign.
 * @param {string} apiSecret API secret.
 * @returns {Promise<string>} Signature.
 * @see https://cloudinary.com/documentation/upload_images#generating_authentication_signatures
 */
const generateSignature = async (params, apiSecret) => {
  // Sort parameters alphabetically and create string to sign
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');

  const stringToSign = `${sortedParams}${apiSecret}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(stringToSign);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Upload files to Cloudinary.
 * @param {File[]} files Files to upload.
 * @param {MediaLibraryFetchOptions} options Options containing the API secret (apiKey).
 * @returns {Promise<ExternalAsset[]>} Uploaded assets.
 * @see https://cloudinary.com/documentation/image_upload_api_reference
 */
export const upload = async (files, options) => {
  if (files.length === 0) {
    return [];
  }

  const { cloudName, apiKey } = getCloudConfig();

  if (!cloudName) {
    return Promise.reject(new Error('Cloudinary cloud name is not configured'));
  }

  if (!apiKey) {
    return Promise.reject(new Error('Cloudinary API key is not configured'));
  }

  const { apiKey: apiSecret } = options;

  if (!apiSecret) {
    return Promise.reject(new Error('Cloudinary API secret is not provided'));
  }

  const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;
  const timestamp = Math.floor(Date.now() / 1000);
  /** @type {CloudinaryResource[]} */
  const uploadedResources = [];

  // Upload files one by one (Cloudinary doesn't support batch uploads in the same way)
  // eslint-disable-next-line no-restricted-syntax
  for (const file of files) {
    const params = {
      timestamp,
    };

    const signature = await generateSignature(params, apiSecret);
    const formData = new FormData();

    formData.append('file', file);
    formData.append('api_key', apiKey);
    formData.append('timestamp', String(timestamp));
    formData.append('signature', signature);

    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();

      throw new Error(`Failed to upload file ${file.name}: ${errorText}`);
    }

    /** @type {CloudinaryResource} */
    const data = await response.json();

    uploadedResources.push(data);

    // Wait a bit between uploads to avoid rate limiting
    if (files.length > 1) {
      await sleep(50);
    }
  }

  return parseResults(uploadedResources);
};

/**
 * @type {MediaLibraryService}
 */
export default {
  serviceType: 'cloud_storage',
  serviceId: 'cloudinary',
  serviceLabel: 'Cloudinary',
  serviceURL: 'https://cloudinary.com/',
  showServiceLink: true,
  hotlinking: true,
  authType: 'api_key',
  developerURL: 'https://cloudinary.com/documentation/',
  apiKeyURL: 'https://console.cloudinary.com/settings/api-keys',
  apiKeyPattern: /^[A-Za-z0-9_-]{15,}$/,
  list,
  search,
  upload,
};
