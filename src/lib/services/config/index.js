import { _ } from '@sveltia/i18n';
import { getHash } from '@sveltia/utils/crypto';
import { isObject } from '@sveltia/utils/object';
import { isURL } from '@sveltia/utils/string';
import merge from 'deepmerge';
import { stringify } from 'yaml';

import { allAssetFolders } from '$lib/services/assets/folders';
import { DEV_SITE_URL } from '$lib/services/config/constants';
import { getAllAssetFolders } from '$lib/services/config/folders/assets';
import { getAllEntryFolders } from '$lib/services/config/folders/entries';
import { fetchCmsConfig } from '$lib/services/config/loader';
import { parseCmsConfig } from '$lib/services/config/parser';
import { getConfigSchemas, validateConfigSchema } from '$lib/services/config/schema';
import { allEntryFolders } from '$lib/services/contents';
import { prefs } from '$lib/services/user/prefs.svelte';
import { createDerivedState, createRawState } from '$lib/services/utils/state.svelte';

/**
 * @import { ConfigParserCollectors, InternalCmsConfig } from '$lib/types/private';
 * @import { CmsConfig } from '$lib/types/public';
 */

const { DEV } = import.meta.env;

export { DEV_SITE_URL };

/**
 * @type {Partial<CmsConfig>}
 */
export const rawCmsConfig = {};

/**
 * @type {{ current: InternalCmsConfig | undefined }}
 */
export const cmsConfig = createRawState();

/**
 * @type {{ current: string | undefined }}
 */
export const cmsConfigVersion = createRawState();

/**
 * @type {{ current: string[] }}
 */
export const cmsConfigErrors = createRawState([]);

/**
 * Whether the CMS configuration has been loaded, regardless of whether it contains errors.
 */
export const cmsConfigLoaded = createDerivedState(
  () => !!cmsConfig.current || !!cmsConfigErrors.current.length,
);

/**
 * Collectors used during config parsing.
 * @type {ConfigParserCollectors}
 */
export const collectors = {
  errors: new Set(),
  warnings: new Set(),
  mediaFields: new Set(),
  relationFields: new Set(),
};

/**
 * Update the entry and asset folder lists based on the given configuration.
 * @param {InternalCmsConfig} config Parsed configuration.
 */
const updateFolders = (config) => {
  const _allEntryFolders = getAllEntryFolders(config);
  const _allAssetFolders = getAllAssetFolders(config, [...collectors.mediaFields]);

  // `getCollection` depends on `allAssetFolders`
  allEntryFolders.current = _allEntryFolders;
  allAssetFolders.current = _allAssetFolders;

  if (prefs.devModeEnabled) {
    // eslint-disable-next-line no-console
    console.info('allEntryFolders', _allEntryFolders);
    // eslint-disable-next-line no-console
    console.info('allAssetFolders', _allAssetFolders);
  }
};

/**
 * Initialize the CMS configuration state by loading the YAML file and optionally merge the object
 * with one specified with `CMS.init()`.
 * @param {CmsConfig} [manualConfig] Raw configuration specified with manual initialization.
 * @todo Normalize configuration object.
 */
export const initCmsConfig = async (manualConfig) => {
  cmsConfig.current = undefined;
  cmsConfigErrors.current = [];

  Object.assign(collectors, {
    errors: new Set(),
    warnings: new Set(),
    mediaFields: new Set(),
    relationFields: new Set(),
  });

  try {
    // Not a config error but `getHash` below and some other features require a secure context
    if (!window.isSecureContext) {
      throw new Error(_('config.error.no_secure_context'));
    }

    /** @type {any} */
    let rawConfig;

    if (manualConfig) {
      if (!isObject(manualConfig)) {
        throw new Error(_('config.error.parse_failed'));
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

    validateConfigSchema({ config: rawConfig, schemas: getConfigSchemas(), collectors });
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
    config._siteURL =
      config.site_url?.trim() || (DEV ? DEV_SITE_URL : /* v8 ignore next */ window.location.origin);
    config._baseURL = isURL(config._siteURL) ? new URL(config._siteURL).origin : '';

    // Handle root collection folder variants, particularly for VitePress
    config.collections?.forEach((collection) => {
      if ('folder' in collection && (collection.folder === '.' || collection.folder === '/')) {
        collection.folder = '';
      }
    });

    cmsConfig.current = config;
    updateFolders(config);
    cmsConfigVersion.current = await getHash(stringify(config));

    // eslint-disable-next-line no-console
    console.debug('CMS configuration:', config);

    if (prefs.devModeEnabled) {
      // eslint-disable-next-line no-console
      console.info('collectors', collectors);
    }
  } catch (/** @type {any} */ ex) {
    cmsConfigErrors.current = collectors.errors.size
      ? [...collectors.errors]
      : [ex.name === 'Error' ? ex.message : _('config.error.unexpected')];

    // eslint-disable-next-line no-console
    console.error(ex, ex.cause);
  }
};
