import { isObject } from '@sveltia/utils/object';
import { locale as appLocale } from 'svelte-i18n';
import { get } from 'svelte/store';
import { siteConfig } from '$lib/services/config';

/**
 * The default, normalized i18n configuration with no locales defined.
 * @type {I18nConfig}
 */
export const defaultI18nConfig = {
  i18nEnabled: false,
  saveAllLocales: true,
  locales: ['_default'],
  defaultLocale: '_default',
  structure: 'single_file',
  canonicalSlug: {
    key: 'translationKey',
    value: '{{slug}}',
  },
};

/**
 * Get the normalized i18n configuration for the given collection or collection file.
 * @param {RawCollection} collection - Developer-defined collection.
 * @param {RawCollectionFile} [file] - Developer-defined collection file.
 * @returns {I18nConfig} Config.
 * @see https://decapcms.org/docs/i18n/
 */
export const getI18nConfig = (collection, file) => {
  const _siteConfig = /** @type {SiteConfig} */ (get(siteConfig));
  /** @type {RawI18nConfig | undefined} */
  let config;

  if (isObject(_siteConfig?.i18n)) {
    config = /** @type {RawI18nConfig} */ (_siteConfig.i18n);

    if (collection?.i18n) {
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
    structure = 'single_file',
    locales = [],
    default_locale: defaultLocale = undefined,
    save_all_locales: saveAllLocales = true,
    canonical_slug: {
      key: canonicalSlugKey = 'translationKey',
      value: canonicalSlugTemplate = '{{slug}}',
    } = {},
  } = /** @type {RawI18nConfig} */ (config ?? {});

  const i18nEnabled = !!locales.length;

  return {
    i18nEnabled,
    saveAllLocales,
    locales: i18nEnabled ? locales : ['_default'],
    defaultLocale: !i18nEnabled
      ? '_default'
      : defaultLocale && locales.includes(defaultLocale)
        ? defaultLocale
        : locales[0],
    structure: !file
      ? structure
      : file.file.includes('{{locale}}')
        ? 'multiple_files'
        : 'single_file',
    canonicalSlug: {
      key: canonicalSlugKey,
      value: canonicalSlugTemplate,
    },
  };
};

/**
 * Get the canonical locale of the given locale that can be used for various `Intl` methods.
 * @param {LocaleCode} locale - Locale.
 * @returns {StandardLocaleCode | undefined} Locale or `undefined` if not determined.
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
 * @param {LocaleCode} locale - Locale code like `en`.
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
 * @param {LocaleCode} locale - Locale code.
 * @param {Partial<Intl.ListFormatOptions>} options - Format options.
 * @returns {Intl.ListFormat} Formatter.
 */
export const getListFormatter = (locale, options = {}) =>
  new Intl.ListFormat(getCanonicalLocale(locale), {
    style: 'narrow',
    type: 'conjunction',
    ...options,
  });
