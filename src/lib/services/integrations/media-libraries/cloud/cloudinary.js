import { cmsConfig } from '$lib/services/config/state';
import {
  findLibraryOptions,
  resolveLibraryOptions,
} from '$lib/services/integrations/media-libraries/options';
import { createRawState } from '$lib/services/utils/state.svelte';

/**
 * @import { MediaLibraryService } from '$lib/types/private';
 * @import { CloudinaryMediaLibrary, CmsConfig, MediaField } from '$lib/types/public';
 */

/**
 * Whether the Cloudinary Media Library integration is activated.
 */
export const activated = createRawState(false);

/**
 * Whether the Cloudinary Media Library console is loaded.
 */
export const consoleLoaded = createRawState(false);

/**
 * Whether the Cloudinary Media Library dialog is open.
 */
export const dialogOpen = createRawState(false);

/**
 * Cloudinary Media Library console URL. Used for the popup and iframe src.
 */
export const CONSOLE_BASE_URL = 'https://console.cloudinary.com/console/media_library';

/**
 * Cloudinary Media Library iframe origin.
 */
export const FRAME_ORIGIN = new URL(CONSOLE_BASE_URL).origin;

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
 * @param {CmsConfig | MediaField} [config] CMS configuration or field configuration.
 * @returns {CloudinaryMediaLibrary | false | undefined} Configuration object, or `false` if
 * explicitly disabled.
 */
export const getLibraryOptions = (config = cmsConfig.current) =>
  findLibraryOptions('cloudinary', config);

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

  const resolved = /** @type {CloudinaryMediaLibrary} */ (
    resolveLibraryOptions('cloudinary', fieldConfig) || {}
  );

  const options = { ...resolved, config: { ...resolved.config } };

  optionCacheMap.set(cacheKey, options);

  return options;
};

/**
 * Get Cloudinary configuration from the site config, with the given field config merged.
 * @param {MediaField} [fieldConfig] Field configuration.
 * @returns {{ cloudName?: string; apiKey?: string }} Cloudinary configuration.
 */
export const getCloudConfig = (fieldConfig) => {
  const options = resolveLibraryOptions('cloudinary', fieldConfig);
  const { cloud_name: cloudName, api_key: apiKey } = (options ? options.config : undefined) ?? {};

  return { cloudName, apiKey };
};

/**
 * Check if Cloudinary integration is enabled.
 * @param {MediaField} [fieldConfig] Field configuration.
 * @returns {boolean} True if enabled, false otherwise.
 */
export const isEnabled = (fieldConfig) => {
  const { cloudName, apiKey } = getCloudConfig(fieldConfig);

  return !!(cloudName && apiKey);
};

/**
 * Whether the given URL points to a file in the configured Cloudinary product environment.
 * @param {string} url URL.
 * @returns {boolean} Result.
 */
export const isAssetURL = (url) => {
  const { cloudName } = getCloudConfig();

  return !!cloudName && url.startsWith(`https://res.cloudinary.com/${cloudName}/`);
};

/**
 * Cloudinary media library service integration. Cloudinary has a CORS restriction that prevents
 * direct API access from the browser, so the service has no `list`, `search` or `upload` method:
 * the Cloudinary Media Library widget is used for authentication and file selection/uploading
 * instead.
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
  isAssetURL,
};
