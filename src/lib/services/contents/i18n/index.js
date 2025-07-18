import { isObject } from '@sveltia/utils/object';
import { get } from 'svelte/store';
import { locale as appLocale } from 'svelte-i18n';
import { siteConfig } from '$lib/services/config';
import { isSingletonCollection } from '$lib/services/contents/collection';

/**
 * @import {
 * InternalI18nOptions,
 * InternalLocaleCode,
 * InternalSiteConfig,
 * } from '$lib/types/private';
 * @import { Collection, CollectionFile, I18nOptions, LocaleCode } from '$lib/types/public';
 */

/**
 * The default, normalized i18n configuration with no locales defined.
 * @type {InternalI18nOptions}
 */
export const DEFAULT_I18N_CONFIG = {
  i18nEnabled: false,
  saveAllLocales: true,
  allLocales: ['_default'],
  initialLocales: ['_default'],
  defaultLocale: '_default',
  structure: 'single_file',
  structureMap: {
    i18nSingleFile: false,
    i18nMultiFile: false,
    i18nMultiFolder: false,
    i18nRootMultiFolder: false,
  },
  canonicalSlug: {
    key: 'translationKey',
    value: '{{slug}}',
  },
  omitDefaultLocaleFromFileName: false,
};

/**
 * Get the normalized i18n configuration for the given collection or collection file.
 * @param {Collection} collection Developer-defined collection.
 * @param {CollectionFile} [file] Developer-defined collection file.
 * @returns {InternalI18nOptions} Config.
 * @see https://decapcms.org/docs/i18n/
 */
export const normalizeI18nConfig = (collection, file) => {
  const _siteConfig = /** @type {InternalSiteConfig} */ (get(siteConfig));
  /** @type {I18nOptions | undefined} */
  let config;

  if (isObject(_siteConfig.i18n)) {
    config = /** @type {I18nOptions} */ (_siteConfig.i18n);

    // Check if the collection has its own i18n configuration. The singleton collection doesn’t have
    // its own i18n configuration, so it will inherit the global one if defined.
    if (collection.i18n || isSingletonCollection(collection)) {
      if (isObject(collection.i18n)) {
        Object.assign(config, collection.i18n);
      }

      if (file) {
        if (file.i18n) {
          if (isObject(file.i18n)) {
            Object.assign(config, file.i18n);
          }
        } else {
          config = undefined;
        }
      }
    } else {
      config = undefined;
    }
  }

  const {
    structure: _structure = 'single_file',
    locales: _locales = [],
    default_locale: _defaultLocale = undefined,
    initial_locales: _initialLocales = undefined,
    save_all_locales: _saveAllLocales = true,
    canonical_slug: {
      key: canonicalSlugKey = 'translationKey',
      value: canonicalSlugTemplate = '{{slug}}',
    } = {},
    omit_default_locale_from_filename: _omitDefaultLocaleFromFileName = false,
  } = /** @type {I18nOptions} */ (config ?? {});

  const i18nEnabled = !!_locales.length;
  const allLocales = i18nEnabled ? _locales : ['_default'];

  const saveAllLocales = i18nEnabled
    ? _saveAllLocales === true && _initialLocales === undefined
    : true;

  const defaultLocale = !i18nEnabled
    ? '_default'
    : _defaultLocale && allLocales.includes(_defaultLocale)
      ? _defaultLocale
      : allLocales[0];

  const initialLocales =
    _initialLocales === 'all'
      ? allLocales
      : _initialLocales === 'default'
        ? [defaultLocale]
        : allLocales.filter(
            (locale) =>
              // Default locale cannot be disabled
              locale === defaultLocale ||
              (Array.isArray(_initialLocales) ? _initialLocales.includes(locale) : true),
          );

  const structure = !file
    ? _structure
    : file.file.includes('{{locale}}')
      ? 'multiple_files'
      : 'single_file';

  const structureMap = {
    i18nSingleFile: i18nEnabled && structure === 'single_file',
    i18nMultiFile: i18nEnabled && structure === 'multiple_files',
    i18nMultiFolder: i18nEnabled && structure === 'multiple_folders',
    i18nRootMultiFolder: i18nEnabled && structure === 'multiple_folders_i18n_root',
  };

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
    omitDefaultLocaleFromFileName:
      _omitDefaultLocaleFromFileName &&
      (file ? /\.{{locale}}\.[a-zA-Z0-9]+$/.test(file.file) : structureMap.i18nMultiFile),
  };
};

/**
 * Get the canonical locale of the given locale that can be used for various `Intl` methods.
 * @param {InternalLocaleCode} locale Locale.
 * @returns {LocaleCode | undefined} Locale or `undefined` if not determined.
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl#locales_argument
 */
export const getCanonicalLocale = (locale) => {
  let canonicalLocale = undefined;

  if (locale !== '_default') {
    try {
      [canonicalLocale] = Intl.getCanonicalLocales(locale);
    } catch {
      //
    }
  }

  return canonicalLocale;
};

/**
 * Translate the given locale code in the application UI locale.
 * @param {InternalLocaleCode} locale Locale code like `en`.
 * @returns {string} Locale label like `English`. If the formatter raises an error, just return the
 * locale code as is.
 */
export const getLocaleLabel = (locale) => {
  const canonicalLocale = getCanonicalLocale(locale);

  if (!canonicalLocale) {
    return locale;
  }

  const formatter = new Intl.DisplayNames(/** @type {string} */ (get(appLocale)), {
    type: 'language',
  });

  try {
    return formatter.of(canonicalLocale) ?? locale;
  } catch (/** @type {any} */ ex) {
    // eslint-disable-next-line no-console
    console.error(ex);

    return locale;
  }
};

/**
 * Get a simple list formatter.
 * @param {InternalLocaleCode} locale Locale code.
 * @param {Partial<Intl.ListFormatOptions>} options Format options.
 * @returns {Intl.ListFormat} Formatter.
 */
export const getListFormatter = (locale, options = {}) =>
  new Intl.ListFormat(getCanonicalLocale(locale), {
    style: 'narrow',
    type: 'conjunction',
    ...options,
  });

/**
 * Get the complete path for the given entry folder, including the locale.
 * @param {object} args Arguments.
 * @param {InternalI18nOptions} args._i18n I18n configuration.
 * @param {InternalLocaleCode} args.locale Locale code.
 * @param {string} args.path Collection file path with `{{locale}}` placeholder.
 * @returns {string} Complete path, including the locale.
 */
export const getLocalePath = ({ _i18n, locale, path }) => {
  const { defaultLocale, omitDefaultLocaleFromFileName } = _i18n;

  // Remove the default locale from the file name (for Zola compatibility)
  // @see https://github.com/sveltia/sveltia-cms/discussions/394
  if (omitDefaultLocaleFromFileName && locale === defaultLocale) {
    path = path.replace(/\.{{locale}}\.(\w+)$/, '.$1');
  }

  // Replace the placeholder with the actual locale. The placeholder may appear multiple times
  // @see https://github.com/sveltia/sveltia-cms/issues/462
  return path.replaceAll('{{locale}}', locale);
};
