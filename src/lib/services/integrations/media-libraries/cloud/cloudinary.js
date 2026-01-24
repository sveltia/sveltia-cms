/* eslint-disable no-await-in-loop */

import { sleep } from '@sveltia/utils/misc';
import { isObject } from '@sveltia/utils/object';
import { get } from 'svelte/store';

import { cmsConfig } from '$lib/services/config';

/**
 * @import {
 * ExternalAsset,
 * MediaLibraryFetchOptions,
 * MediaLibraryService,
 * } from '$lib/types/private';
 * @import { CloudinaryMediaLibrary, CmsConfig, MediaField } from '$lib/types/public';
 */

/**
 * @typedef {object} CloudinaryResource
 * @property {string} asset_id Asset ID.
 * @property {string} filename Filename without extension.
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
 */

/**
 * Cloudinary Media Library iframe origin.
 */
export const FRAME_ORIGIN = 'https://console.cloudinary.com';

/**
 * Cloudinary Media Library iframe’s `src` search parameters.
 */
export const FRAME_SRC_PARAMS = [
  'cloud_name',
  'api_key',
  'username',
  'timestamp',
  'signature',
  'integration',
  'use_saml',
  'saml_iframe_support',
];

/**
 * Cloudinary Media Library configuration properties.
 */
export const CONFIG_PROPS = [
  'integration',
  'inline_container',
  'z_index',
  'multiple',
  'max_files',
  'default_transformations',
  'insert_caption',
  'remove_header',
  'folder',
  'search',
  'collection',
  'asset',
  'transformation',
  'sandboxNotAllowedAttributes',
  'theme',
];

/**
 * Get Cloudinary library options from site config.
 * @internal
 * @param {CmsConfig | MediaField} [config] CMS configuration or field configuration.
 * @returns {CloudinaryMediaLibrary | undefined} Configuration object.
 */
export const getLibraryOptions = (config) => {
  const _cmsConfig = get(cmsConfig);

  config ??= _cmsConfig;

  // Check for explicit media_libraries.cloudinary config (preferred)
  if (config?.media_libraries?.cloudinary) {
    return config.media_libraries.cloudinary;
  }

  // Fall back to legacy media_library config
  if (!config?.media_library) {
    return undefined;
  }

  const isExplicitlyCloudinary = config.media_library.name === 'cloudinary';

  const isImplicitlyCloudinary =
    !config.media_library.name && _cmsConfig?.media_library?.name === 'cloudinary';

  if (isExplicitlyCloudinary || isImplicitlyCloudinary) {
    return /** @type {CloudinaryMediaLibrary} */ (config.media_library);
  }

  return undefined;
};

/**
 * @type {Map<string, CloudinaryMediaLibrary>}
 */
export const optionCacheMap = new Map();

/**
 * Get merged Cloudinary library options from site and field config.
 * Field config options override site config options.
 * @param {MediaField} [fieldConfig] Field configuration.
 * @returns {CloudinaryMediaLibrary} Merged configuration object.
 */
export const getMergedLibraryOptions = (fieldConfig) => {
  const cacheKey = fieldConfig ? JSON.stringify(fieldConfig) : 'global';
  const cache = optionCacheMap.get(cacheKey);

  if (cache) {
    return cache;
  }

  const siteOptions = getLibraryOptions() ?? { config: {} };
  const fieldOptions = getLibraryOptions(fieldConfig) ?? { config: {} };

  const options = {
    ...siteOptions,
    ...fieldOptions,
    config: {
      ...siteOptions.config,
      ...fieldOptions.config,
    },
  };

  optionCacheMap.set(cacheKey, options);

  return options;
};

/**
 * Get Cloudinary configuration from site config.
 * @internal
 * @returns {{ cloudName?: string; apiKey?: string }} Cloudinary configuration.
 */
export const getCloudConfig = () => {
  const { cloud_name: cloudName, api_key: apiKey } = getLibraryOptions()?.config ?? {};

  return { cloudName, apiKey };
};

/**
 * Check if Cloudinary integration is enabled.
 * @returns {boolean} True if enabled, false otherwise.
 */
export const isEnabled = () => {
  const { cloudName, apiKey } = getCloudConfig();

  return !!(cloudName && apiKey);
};

/**
 * Convert transformation object to Cloudinary transformation string.
 * @internal
 * @param {Record<string, any>} transformation Transformation object. E.g. `{ width: 400, crop:
 * 'scale' }`.
 * @returns {string} Transformation string. E.g. `w_400,c_scale`.
 * @see https://cloudinary.com/documentation/transformation_reference
 * @see https://decapcms.org/docs/cloudinary/#image-transformations
 * @see https://sveltiacms.app/en/docs/media/cloudinary#image-transformations
 */
export const transformationToString = (transformation) => {
  // Mapping from full parameter names to Cloudinary URL abbreviations
  /** @type {Record<string, string>} */
  const parameterMap = {
    angle: 'a',
    audio_codec: 'ac',
    audio_frequency: 'af',
    aspect_ratio: 'ar',
    background: 'b',
    border: 'bo',
    color: 'co',
    crop: 'c',
    default_image: 'd',
    delay: 'dl',
    density: 'dn',
    dpr: 'dpr',
    duration: 'du',
    effect: 'e',
    end_offset: 'eo',
    fetch_format: 'f',
    flags: 'fl',
    fps: 'fps',
    gravity: 'g',
    height: 'h',
    overlay: 'l',
    opacity: 'o',
    page: 'pg',
    quality: 'q',
    radius: 'r',
    start_offset: 'so',
    streaming_profile: 'sp',
    transformation: 't',
    underlay: 'u',
    video_codec: 'vc',
    video_sampling: 'vs',
    width: 'w',
    x: 'x',
    y: 'y',
    zoom: 'z',
  };

  /** @type {string[]} */
  const parts = [];

  // Process each key in the transformation object
  Object.keys(transformation).forEach((key) => {
    const value = transformation[key];
    const abbreviation = parameterMap[key] || key;

    // Skip undefined/null values
    if (value === undefined || value === null) {
      return;
    }

    // Handle different value types
    if (typeof value === 'boolean') {
      // For boolean flags, only include if true
      if (value) {
        parts.push(abbreviation);
      }
    } else if (Array.isArray(value)) {
      // For arrays, join with dots (e.g., for flags)
      parts.push(`${abbreviation}_${value.join('.')}`);
    } else {
      // For all other values, use key_value format
      parts.push(`${abbreviation}_${value}`);
    }
  });

  // Join all parts with commas
  return parts.join(',');
};

/**
 * Parse API results into ExternalAsset format.
 * @internal
 * @param {CloudinaryResource[]} results API results.
 * @param {object} [options] Additional options.
 * @param {MediaField} [options.fieldConfig] Field configuration for custom handling.
 * @returns {ExternalAsset[]} Assets.
 * @see https://decapcms.org/docs/cloudinary/#decap-cms-configuration-options
 * @see https://sveltiacms.app/en/docs/media/cloudinary#configuration
 */
export const parseResults = (results, { fieldConfig } = {}) => {
  const {
    output_filename_only: fileNameOnly = false,
    use_transformations: useTransformations = true,
    config: { default_transformations: defaultTransformations = [] } = {},
  } = getLibraryOptions(fieldConfig) ?? getLibraryOptions() ?? {};

  const transformation = /** @type {Record<string, any>[][]} */ (defaultTransformations)?.[0]?.[0];
  const hasTransformation = useTransformations && isObject(transformation);

  return results.map((result) => {
    const {
      asset_id: assetId,
      resource_type: resourceType,
      secure_url: url,
      created_at: timestamp,
      bytes: size,
    } = result;

    const fileName = /** @type {string} */ (url.split('/').pop());

    return {
      id: assetId,
      description: fileName,
      previewURL: url.replace('/upload/', '/upload/w_400,c_limit/'),
      downloadURL: fileNameOnly
        ? fileName
        : hasTransformation
          ? url.replace('/upload/', `/upload/${transformationToString(transformation)}/`)
          : url,
      fileName,
      lastModified: new Date(timestamp),
      size,
      kind: resourceType === 'image' ? 'image' : resourceType === 'video' ? 'video' : 'other',
    };
  });
};

/**
 * Generate Basic Auth header for Cloudinary API.
 * @internal
 * @param {string} apiKey API key.
 * @param {string} apiSecret API secret.
 * @returns {string} Basic Auth header value.
 */
export const generateAuthHeader = (apiKey, apiSecret) => {
  const credentials = `${apiKey}:${apiSecret}`;
  const encoded = btoa(credentials);

  return `Basic ${encoded}`;
};

/**
 * Fetch resources from Cloudinary API with pagination.
 * @internal
 * @param {MediaLibraryFetchOptions} options Options containing the API secret (apiKey).
 * @param {object} [config] Additional configuration.
 * @param {number} [config.maxPages] Maximum number of pages to fetch. Default: 10.
 * @param {string} [config.expression] Search expression for filtering.
 * @returns {Promise<ExternalAsset[]>} Assets.
 * @see https://cloudinary.com/documentation/admin_api#search_for_resources
 */
export const fetchResources = async (options, { maxPages = 10, expression } = {}) => {
  const { cloudName, apiKey } = getCloudConfig();

  if (!cloudName) {
    return Promise.reject(new Error('Cloudinary cloud name is not configured'));
  }

  if (!apiKey) {
    return Promise.reject(new Error('Cloudinary API key is not configured'));
  }

  const { kind, fieldConfig, apiKey: apiSecret } = options;

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

    const params = new URLSearchParams({
      max_results: '100',
      ...(filterExpression && { expression: filterExpression }),
      ...(nextCursor && { next_cursor: nextCursor }),
    });

    const response = await fetch(`${endpoint}?${params}`, { headers });

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

  return parseResults(allResources, { fieldConfig });
};

/**
 * List resources from Cloudinary.
 * @param {MediaLibraryFetchOptions} options Options containing the API secret (apiKey).
 * @returns {Promise<ExternalAsset[]>} Assets.
 */
export const list = async (options) => fetchResources(options);

/**
 * Search resources in Cloudinary using the Search API.
 * @param {string} query Search query.
 * @param {MediaLibraryFetchOptions} options Options containing the API secret (apiKey).
 * @returns {Promise<ExternalAsset[]>} Assets.
 */
export const search = async (query, options) => {
  // Build a search expression that searches in public_id and filename
  const expression = `public_id:*${query}* OR filename:*${query}*`;

  return fetchResources(options, { expression });
};

/**
 * Generate signature for Cloudinary upload.
 * @internal
 * @param {Record<string, string | number>} params Parameters to sign.
 * @param {string} apiSecret API secret.
 * @returns {Promise<string>} Signature.
 * @see https://cloudinary.com/documentation/upload_images#generating_authentication_signatures
 */
export const generateSignature = async (params, apiSecret) => {
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

  const { fieldConfig, apiKey: apiSecret } = options;

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

  return parseResults(uploadedResources, { fieldConfig });
};

/**
 * Cloudinary media library service integration. The `list`, `search`, and `upload` methods are not
 * used at this time because Cloudinary has a CORS restriction that prevents direct API access from
 * the browser. Instead, the Cloudinary Media Library widget is used for authentication and file
 * selection/uploading.
 * @type {MediaLibraryService}
 */
export default {
  serviceType: 'cloud_storage',
  serviceId: 'cloudinary',
  serviceLabel: 'Cloudinary',
  serviceURL: 'https://cloudinary.com/',
  showServiceLink: true,
  hotlinking: true,
  authType: 'widget',
  developerURL: 'https://cloudinary.com/documentation/',
  apiKeyURL: 'https://console.cloudinary.com/settings/api-keys',
  apiKeyPattern: /^[A-Za-z0-9_-]{15,}$/,
  isEnabled,
};
