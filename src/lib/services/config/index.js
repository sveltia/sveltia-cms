import { getHash } from '@sveltia/utils/crypto';
import { isObject } from '@sveltia/utils/object';
import { isURL } from '@sveltia/utils/string';
import merge from 'deepmerge';
import { get, writable } from 'svelte/store';
import { _ } from 'svelte-i18n';
import YAML from 'yaml';
import { allAssetFolders } from '$lib/services/assets/folders';
import { gitBackendServices, validBackendNames } from '$lib/services/backends';
import { getAllAssetFolders } from '$lib/services/config/folders/assets';
import { getAllEntryFolders } from '$lib/services/config/folders/entries';
import { fetchSiteConfig } from '$lib/services/config/loader';
import { allEntryFolders } from '$lib/services/contents';
import { prefs } from '$lib/services/user/prefs';

/**
 * @import { Writable } from 'svelte/store';
 * @import { SiteConfig } from '$lib/types/public'
 * @import { InternalSiteConfig } from '$lib/types/private';
 */

const { DEV, VITE_SITE_URL } = import.meta.env;

/**
 * The local live site URL. Local development can be done by loading a CMS config file from a
 * separate dev server. By default, this assumes a local SvelteKit site is running on port 5174
 * along with Sveltia CMS on port 5173. The site URL can be specified with the `VITE_SITE_URL`
 * environment variable. For example, run `VITE_SITE_URL=http://localhost:3000 pnpm dev` for
 * Next.js. You probably need to define the `Access-Control-Allow-Origin: *` HTTP response header
 * with the dev server’s middleware, or loading the CMS config file may fail due to a CORS error.
 */
export const DEV_SITE_URL = DEV ? VITE_SITE_URL || 'http://localhost:5174' : undefined;
/**
 * @type {Partial<SiteConfig>}
 */
export const rawSiteConfig = {};
/**
 * @type {Writable<InternalSiteConfig | undefined>}
 */
export const siteConfig = writable();
/**
 * @type {Writable<string | undefined>}
 */
export const siteConfigVersion = writable();
/**
 * @type {Writable<{ message: string } | undefined>}
 */
export const siteConfigError = writable();

/**
 * Validate the site configuration file.
 * @param {SiteConfig} config Raw config object.
 * @throws {Error} If there is an error in the config.
 * @see https://decapcms.org/docs/configuration-options/
 * @todo Add more validations.
 */
export const validate = (config) => {
  if (!config.collections?.length) {
    throw new Error(get(_)('config.error.no_collection'));
  }

  if (!config.backend) {
    throw new Error(get(_)('config.error.missing_backend'));
  }

  if (!config.backend.name) {
    throw new Error(get(_)('config.error.missing_backend_name'));
  }

  if (!validBackendNames.includes(config.backend.name)) {
    throw new Error(
      get(_)('config.error.unsupported_backend', { values: { name: config.backend.name } }),
    );
  }

  if (Object.keys(gitBackendServices).includes(config.backend.name)) {
    if (config.backend.repo === undefined) {
      throw new Error(get(_)('config.error.missing_repository'));
    }

    if (typeof config.backend.repo !== 'string' || !/(.+)\/([^/]+)$/.test(config.backend.repo)) {
      throw new Error(get(_)('config.error.invalid_repository'));
    }
  }

  if (config.backend.auth_type === 'implicit') {
    throw new Error(get(_)('config.error.oauth_implicit_flow'));
  }

  if (config.backend.auth_type === 'pkce' && !config.backend.app_id) {
    throw new Error(get(_)('config.error.oauth_no_app_id'));
  }

  if (config.media_folder === undefined) {
    throw new Error(get(_)('config.error.missing_media_folder'));
  }

  if (typeof config.media_folder !== 'string') {
    throw new Error(get(_)('config.error.invalid_media_folder'));
  }

  if (config.public_folder !== undefined) {
    if (typeof config.public_folder !== 'string') {
      throw new Error(get(_)('config.error.invalid_public_folder'));
    }

    if (/^\.{1,2}\//.test(config.public_folder)) {
      throw new Error(get(_)('config.error.public_folder_relative_path'));
    }

    if (/^https?:/.test(config.public_folder)) {
      throw new Error(get(_)('config.error.public_folder_absolute_url'));
    }
  }
};

/**
 * Initialize the site configuration state by loading the YAML file and optionally merge the object
 * with one specified with `CMS.init()`.
 * @param {SiteConfig} [manualConfig] Raw configuration specified with manual initialization.
 * @todo Normalize configuration object.
 */
export const initSiteConfig = async (manualConfig) => {
  siteConfig.set(undefined);
  siteConfigError.set(undefined);

  try {
    // Not a config error but `getHash` below and some other features require a secure context
    if (!window.isSecureContext) {
      throw new Error(get(_)('config.error.no_secure_context'));
    }

    /** @type {any} */
    let rawConfig;

    if (manualConfig) {
      if (!isObject(manualConfig)) {
        throw new Error(get(_)('config.error.parse_failed'));
      }

      rawConfig = manualConfig;

      if (rawConfig.load_config_file !== false) {
        rawConfig = merge(await fetchSiteConfig(), rawConfig);
      }
    } else {
      rawConfig = await fetchSiteConfig();
    }

    // Store the raw config so it can be used in the parser and config viewer
    Object.assign(rawSiteConfig, rawConfig);

    validate(rawConfig);

    /** @type {InternalSiteConfig} */
    const config = structuredClone(rawConfig);

    // Set the site URL for development or production. See also `/src/lib/components/app.svelte`
    config._siteURL = config.site_url?.trim() || (DEV ? DEV_SITE_URL : window.location.origin);
    config._baseURL = isURL(config._siteURL) ? new URL(config._siteURL).origin : '';

    // Handle root collection folder variants, particularly for VitePress
    config.collections.forEach((collection) => {
      if ('folder' in collection && (collection.folder === '.' || collection.folder === '/')) {
        collection.folder = '';
      }
    });

    siteConfig.set(config);
    siteConfigVersion.set(await getHash(YAML.stringify(config)));
  } catch (/** @type {any} */ ex) {
    siteConfigError.set({
      message: ex.name === 'Error' ? ex.message : get(_)('config.error.unexpected'),
    });

    // eslint-disable-next-line no-console
    console.error(ex, ex.cause);
  }
};

siteConfig.subscribe((config) => {
  if (get(prefs).devModeEnabled) {
    // eslint-disable-next-line no-console
    console.info('siteConfig', config);
  }

  if (!config) {
    return;
  }

  const _allEntryFolders = getAllEntryFolders(config);
  const _allAssetFolders = getAllAssetFolders(config);

  // `getCollection` depends on `allAssetFolders`
  allEntryFolders.set(_allEntryFolders);
  allAssetFolders.set(_allAssetFolders);

  if (get(prefs).devModeEnabled) {
    // eslint-disable-next-line no-console
    console.info('allEntryFolders', _allEntryFolders);
    // eslint-disable-next-line no-console
    console.info('allAssetFolders', _allAssetFolders);
  }
});
