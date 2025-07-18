import { isObject } from '@sveltia/utils/object';
import { get } from 'svelte/store';
import { siteConfig } from '$lib/services/config';
import { isSingletonCollection } from '$lib/services/contents/collection';

/**
 * @import {
 * I18nFileStructureMap,
 * InternalI18nOptions,
 * InternalSiteConfig,
 * } from '$lib/types/private';
 * @import { Collection, CollectionFile, I18nFileStructure, I18nOptions } from '$lib/types/public';
 */

/**
 * I18n structure types.
 * @type {Record<string, I18nFileStructure>}
 */
const I18N_STRUCTURES = {
  SINGLE_FILE: 'single_file',
  MULTIPLE_FILES: 'multiple_files',
  MULTIPLE_FOLDERS: 'multiple_folders',
  MULTIPLE_FOLDERS_I18N_ROOT: 'multiple_folders_i18n_root',
};

/**
 * Default locale identifier.
 */
const DEFAULT_LOCALE_KEY = '_default';

/**
 * Default canonical slug configuration.
 */
const DEFAULT_CANONICAL_SLUG = {
  key: 'translationKey',
  value: '{{slug}}',
};

/**
 * The default, normalized i18n configuration with no locales defined.
 * @type {InternalI18nOptions}
 */
export const DEFAULT_I18N_CONFIG = {
  i18nEnabled: false,
  saveAllLocales: true,
  allLocales: [DEFAULT_LOCALE_KEY],
  initialLocales: [DEFAULT_LOCALE_KEY],
  defaultLocale: DEFAULT_LOCALE_KEY,
  structure: I18N_STRUCTURES.SINGLE_FILE,
  structureMap: {
    i18nSingleFile: false,
    i18nMultiFile: false,
    i18nMultiFolder: false,
    i18nRootMultiFolder: false,
  },
  canonicalSlug: { ...DEFAULT_CANONICAL_SLUG },
  omitDefaultLocaleFromFileName: false,
};

/**
 * Merges i18n configuration from site, collection, and file levels.
 * @param {Collection} collection The collection configuration.
 * @param {CollectionFile} [file] The collection file configuration.
 * @returns {I18nOptions | undefined} Merged configuration or undefined if i18n is not enabled.
 */
const mergeI18nConfigs = (collection, file) => {
  const siteConfigValue = /** @type {InternalSiteConfig} */ (get(siteConfig));

  if (!isObject(siteConfigValue.i18n)) {
    return undefined;
  }

  const config = /** @type {I18nOptions} */ ({ ...siteConfigValue.i18n });
  const hasCollectionI18n = collection.i18n || isSingletonCollection(collection);

  // Check if the collection has its own i18n configuration. The singleton collection doesn't have
  // its own i18n configuration, so it will inherit the global one if defined.
  if (hasCollectionI18n) {
    if (isObject(collection.i18n)) {
      Object.assign(config, collection.i18n);
    }

    if (file) {
      if (file.i18n) {
        if (isObject(file.i18n)) {
          Object.assign(config, file.i18n);
        }
      } else {
        return undefined;
      }
    }
  } else {
    return undefined;
  }

  return config;
};

/**
 * Determines the appropriate structure based on file configuration.
 * @param {I18nFileStructure} defaultStructure The default structure from config.
 * @param {CollectionFile} [file] The collection file configuration.
 * @returns {I18nFileStructure} The determined structure.
 */
const determineStructure = (defaultStructure, file) => {
  if (!file) {
    return defaultStructure;
  }

  return file.file.includes('{{locale}}')
    ? I18N_STRUCTURES.MULTIPLE_FILES
    : I18N_STRUCTURES.SINGLE_FILE;
};

/**
 * Creates the structure map based on i18n status and structure.
 * @param {boolean} i18nEnabled Whether i18n is enabled.
 * @param {string} structure The current structure.
 * @returns {I18nFileStructureMap} The structure map.
 */
const createStructureMap = (i18nEnabled, structure) => ({
  i18nSingleFile: i18nEnabled && structure === I18N_STRUCTURES.SINGLE_FILE,
  i18nMultiFile: i18nEnabled && structure === I18N_STRUCTURES.MULTIPLE_FILES,
  i18nMultiFolder: i18nEnabled && structure === I18N_STRUCTURES.MULTIPLE_FOLDERS,
  i18nRootMultiFolder: i18nEnabled && structure === I18N_STRUCTURES.MULTIPLE_FOLDERS_I18N_ROOT,
});

/**
 * Determines the default locale from the available locales.
 * @param {boolean} i18nEnabled Whether i18n is enabled.
 * @param {string[]} allLocales All available locales.
 * @param {string} [specifiedDefault] The specified default locale.
 * @returns {string} The default locale.
 */
const determineDefaultLocale = (i18nEnabled, allLocales, specifiedDefault) => {
  if (!i18nEnabled) {
    return DEFAULT_LOCALE_KEY;
  }

  return specifiedDefault && allLocales.includes(specifiedDefault)
    ? specifiedDefault
    : allLocales[0];
};

/**
 * Determines the initial locales based on configuration.
 * @param {string | string[] | undefined} initialLocalesConfig The initial locales configuration.
 * @param {string[]} allLocales All available locales.
 * @param {string} defaultLocale The default locale.
 * @returns {string[]} The initial locales.
 */
const determineInitialLocales = (initialLocalesConfig, allLocales, defaultLocale) => {
  if (initialLocalesConfig === 'all') {
    return allLocales;
  }

  if (initialLocalesConfig === 'default') {
    return [defaultLocale];
  }

  return allLocales.filter(
    (locale) =>
      // Default locale cannot be disabled
      locale === defaultLocale ||
      (Array.isArray(initialLocalesConfig) ? initialLocalesConfig.includes(locale) : true),
  );
};

/**
 * Get the normalized i18n configuration for the given collection or collection file.
 * @param {Collection} collection Developer-defined collection.
 * @param {CollectionFile} [file] Developer-defined collection file.
 * @returns {InternalI18nOptions} Config.
 * @see https://decapcms.org/docs/i18n/
 */
export const normalizeI18nConfig = (collection, file) => {
  const config = mergeI18nConfigs(collection, file);

  const {
    structure: defaultStructure = I18N_STRUCTURES.SINGLE_FILE,
    locales = [],
    default_locale: specifiedDefaultLocale,
    initial_locales: initialLocalesConfig,
    save_all_locales: saveAllLocalesConfig = true,
    canonical_slug: canonicalSlugConfig = { key: undefined, value: undefined },
    omit_default_locale_from_filename: omitDefaultConfig = false,
  } = config ?? {};

  const {
    key: canonicalSlugKey = DEFAULT_CANONICAL_SLUG.key,
    value: canonicalSlugTemplate = DEFAULT_CANONICAL_SLUG.value,
  } = canonicalSlugConfig;

  const i18nEnabled = locales.length > 0;
  const allLocales = i18nEnabled ? locales : [DEFAULT_LOCALE_KEY];
  const defaultLocale = determineDefaultLocale(i18nEnabled, allLocales, specifiedDefaultLocale);
  const structure = determineStructure(defaultStructure, file);
  const structureMap = createStructureMap(i18nEnabled, structure);

  const saveAllLocales = i18nEnabled
    ? saveAllLocalesConfig === true && initialLocalesConfig === undefined
    : true;

  const initialLocales = determineInitialLocales(initialLocalesConfig, allLocales, defaultLocale);

  const omitDefaultLocaleFromFileName =
    omitDefaultConfig &&
    (file ? /\.{{locale}}\.[a-zA-Z0-9]+$/.test(file.file) : structureMap.i18nMultiFile);

  return {
    i18nEnabled,
    saveAllLocales,
    allLocales,
    defaultLocale,
    initialLocales,
    structure,
    structureMap,
    canonicalSlug: {
      key: canonicalSlugKey,
      value: canonicalSlugTemplate,
    },
    omitDefaultLocaleFromFileName,
  };
};
