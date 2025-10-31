import { getHash } from '@sveltia/utils/crypto';
import { isObject } from '@sveltia/utils/object';
import { isURL } from '@sveltia/utils/string';
import merge from 'deepmerge';
import { get, writable } from 'svelte/store';
import { _ } from 'svelte-i18n';
import { stringify } from 'yaml';

import { allAssetFolders } from '$lib/services/assets/folders';
import { getAllAssetFolders } from '$lib/services/config/folders/assets';
import { getAllEntryFolders } from '$lib/services/config/folders/entries';
import { fetchSiteConfig } from '$lib/services/config/loader';
import { parseSiteConfig } from '$lib/services/config/parser';
import { allEntryFolders } from '$lib/services/contents';
import { prefs } from '$lib/services/user/prefs';

/**
 * @import { Writable } from 'svelte/store';
 * @import { InternalSiteConfig } from '$lib/types/private';
 * @import { SiteConfig } from '$lib/types/public';
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

    parseSiteConfig(rawConfig);

    /** @type {InternalSiteConfig} */
    const config = structuredClone(rawConfig);

    // Set the site URL for development or production. See also `/src/lib/components/app.svelte`
    config._siteURL = config.site_url?.trim() || (DEV ? DEV_SITE_URL : window.location.origin);
    config._baseURL = isURL(config._siteURL) ? new URL(config._siteURL).origin : '';

    // Handle root collection folder variants, particularly for VitePress
    config.collections?.forEach((collection) => {
      if ('folder' in collection && (collection.folder === '.' || collection.folder === '/')) {
        collection.folder = '';
      }
    });

    siteConfig.set(config);
    siteConfigVersion.set(await getHash(stringify(config)));
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
