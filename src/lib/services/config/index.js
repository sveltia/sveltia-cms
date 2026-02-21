import { getHash } from '@sveltia/utils/crypto';
import { isObject } from '@sveltia/utils/object';
import { isURL } from '@sveltia/utils/string';
import merge from 'deepmerge';
import { derived, get, writable } from 'svelte/store';
import { _ } from 'svelte-i18n';
import { stringify } from 'yaml';

import { allAssetFolders } from '$lib/services/assets/folders';
import { getAllAssetFolders } from '$lib/services/config/folders/assets';
import { getAllEntryFolders } from '$lib/services/config/folders/entries';
import { fetchCmsConfig } from '$lib/services/config/loader';
import { parseCmsConfig } from '$lib/services/config/parser';
import { allEntryFolders } from '$lib/services/contents';
import { prefs } from '$lib/services/user/prefs';

/**
 * @import { Readable, Writable } from 'svelte/store';
 * @import { ConfigParserCollectors, InternalCmsConfig } from '$lib/types/private';
 * @import { CmsConfig } from '$lib/types/public';
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
 * @type {Partial<CmsConfig>}
 */
export const rawCmsConfig = {};

/**
 * @type {Writable<InternalCmsConfig | undefined>}
 */
export const cmsConfig = writable();

/**
 * @type {Writable<string | undefined>}
 */
export const cmsConfigVersion = writable();

/**
 * @type {Writable<string[]>}
 */
export const cmsConfigErrors = writable([]);

/**
 * Whether the CMS configuration has been loaded, regardless of whether it contains errors.
 * @type {Readable<boolean>}
 */
export const cmsConfigLoaded = derived(
  [cmsConfig, cmsConfigErrors],
  ([_cmsConfig, _cmsConfigErrors]) => !!_cmsConfig || !!_cmsConfigErrors.length,
);

/**
 * Collectors used during config parsing.
 * @type {ConfigParserCollectors}
 */
const collectors = {
  errors: new Set(),
  warnings: new Set(),
  mediaFields: new Set(),
  relationFields: new Set(),
};

/**
 * Initialize the CMS configuration state by loading the YAML file and optionally merge the object
 * with one specified with `CMS.init()`.
 * @param {CmsConfig} [manualConfig] Raw configuration specified with manual initialization.
 * @todo Normalize configuration object.
 */
export const initCmsConfig = async (manualConfig) => {
  cmsConfig.set(undefined);
  cmsConfigErrors.set([]);

  Object.assign(collectors, {
    errors: new Set(),
    warnings: new Set(),
    mediaFields: new Set(),
    relationFields: new Set(),
  });

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
        rawConfig = merge(await fetchCmsConfig({ manualInit: true }), rawConfig);
      }
    } else {
      rawConfig = await fetchCmsConfig();
    }

    // Store the raw config so it can be used in the parser and config viewer
    Object.assign(rawCmsConfig, rawConfig);

    parseCmsConfig(rawConfig, collectors);

    if (collectors.errors.size) {
      collectors.errors.forEach((warning) => {
        // eslint-disable-next-line no-console
        console.error(warning);
      });

      throw new Error('Errors found in configuration');
    }

    if (collectors.warnings.size) {
      collectors.warnings.forEach((warning) => {
        // eslint-disable-next-line no-console
        console.warn(warning);
      });
    }

    /** @type {InternalCmsConfig} */
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

    cmsConfig.set(config);
    cmsConfigVersion.set(await getHash(stringify(config)));
  } catch (/** @type {any} */ ex) {
    cmsConfigErrors.set(
      collectors.errors.size
        ? [...collectors.errors]
        : [ex.name === 'Error' ? ex.message : get(_)('config.error.unexpected')],
    );

    // eslint-disable-next-line no-console
    console.error(ex, ex.cause);
  }
};

cmsConfig.subscribe((config) => {
  if (get(prefs).devModeEnabled) {
    // eslint-disable-next-line no-console
    console.info('cmsConfig', config);
    // eslint-disable-next-line no-console
    console.info('collectors', collectors);
  }

  if (!config) {
    return;
  }

  const _allEntryFolders = getAllEntryFolders(config);
  const _allAssetFolders = getAllAssetFolders(config, [...collectors.mediaFields]);

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
