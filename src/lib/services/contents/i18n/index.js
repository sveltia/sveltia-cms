import { isObject } from '@sveltia/utils/object';
import { locale as appLocale } from 'svelte-i18n';
import { get } from 'svelte/store';
import { siteConfig } from '$lib/services/config';

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
export const defaultI18nConfig = {
  i18nEnabled: false,
  saveAllLocales: true,
  allLocales: ['_default'],
  initialLocales: ['_default'],
  defaultLocale: '_default',
  structure: 'single_file',
  canonicalSlug: {
    key: 'translationKey',
    value: '{{slug}}',
  },
};

/**
 * Get the normalized i18n configuration for the given collection or collection file.
 * @param {Collection} collection Developer-defined collection.
 * @param {CollectionFile} [file] Developer-defined collection file.
 * @returns {InternalI18nOptions} Config.
 * @see https://decapcms.org/docs/i18n/
 */
export const getI18nConfig = (collection, file) => {
  const _siteConfig = /** @type {InternalSiteConfig} */ (get(siteConfig));
  /** @type {I18nOptions | undefined} */
  let config;

  if (isObject(_siteConfig.i18n)) {
    config = /** @type {I18nOptions} */ (_siteConfig.i18n);

    if (collection.i18n) {
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

  return {
    i18nEnabled,
    saveAllLocales,
    allLocales,
    defaultLocale,
    initialLocales,
    structure,
    canonicalSlug: {
      key: canonicalSlugKey,
      value: canonicalSlugTemplate,
    },
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
