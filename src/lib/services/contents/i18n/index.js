import { locale as appLocale, isRTL } from '@sveltia/i18n';

import { fillLocalePlaceholder } from '$lib/services/contents/i18n/placeholder';
import { getOrCreate } from '$lib/services/utils/cache';

/**
 * @import { InternalI18nOptions, InternalLocaleCode, } from '$lib/types/private';
 * @import { LocaleCode } from '$lib/types/public';
 */

/**
 * Default options for `Intl.DisplayNames()`. Use `English (US)` instead of `American English` for a
 * better language listing.
 * @type {Intl.DisplayNamesOptions}
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DisplayNames/DisplayNames
 */
const LANG_FORMATTER_OPTIONS = {
  type: 'language',
  languageDisplay: 'standard',
  style: 'short',
  fallback: 'none',
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
 * Get the text direction for the given locale.
 * @param {InternalLocaleCode} locale Locale.
 * @returns {'ltr' | 'rtl' | 'auto'} Text direction. Returns `auto` if i18n is disabled (i.e.
 * `locale` is `_default`), `rtl` if the locale is a right-to-left language, and `ltr` otherwise.
 */
export const getDirection = (locale) =>
  locale === '_default' ? 'auto' : isRTL(locale) ? 'rtl' : 'ltr';

/**
 * Cache of {@link Intl.DisplayNames} instances, keyed by `displayLocale`.
 * @type {Map<string, Intl.DisplayNames>}
 */
const displayNamesCache = new Map();

/**
 * Translate the given locale code in the application UI locale.
 * @param {InternalLocaleCode} locale Locale code like `en`.
 * @param {object} [options] Options.
 * @param {InternalLocaleCode} [options.displayLocale] Locale code to display the locale name. If
 * not given, use the current application locale. Default is `en`.
 * @param {Intl.DisplayNamesOptions} [options.formatterOptions] Options for `Intl.DisplayNames()`.
 * @returns {string | undefined} Locale label like `English`. If the locale is not valid, returns
 * `undefined`.
 */
export const getLocaleLabel = (
  locale,
  {
    displayLocale = getCanonicalLocale(appLocale.current ?? 'en'),
    formatterOptions = LANG_FORMATTER_OPTIONS,
  } = {},
) => {
  const canonicalLocale = getCanonicalLocale(locale);

  if (!canonicalLocale) {
    return undefined;
  }

  const formatter = displayLocale
    ? getOrCreate(
        displayNamesCache,
        displayLocale,
        () => new Intl.DisplayNames(displayLocale, formatterOptions),
      )
    : new Intl.DisplayNames(undefined, formatterOptions);

  try {
    const label = formatter.of(canonicalLocale);

    if (!label) {
      return undefined;
    }

    const [firstLetter, ...rest] = label;

    // Capitalize the label because the native `of()` method returns all lowercase in some languages
    return [firstLetter.toLocaleUpperCase(displayLocale), ...rest].join('');
  } catch (/** @type {any} */ ex) {
    // eslint-disable-next-line no-console
    console.error(ex);

    return undefined;
  }
};

/**
 * List formatter that, unlike {@link Intl.ListFormat}, accepts items of any type.
 * @typedef {{ format: (list: Iterable<any>) => string }} ListFormatter
 */

/**
 * Cache of list formatters, keyed by `"${locale}|${serializedOptions}"`.
 * @type {Map<string, ListFormatter>}
 */
const listFormatterCache = new Map();

/**
 * Get a simple list formatter. `Intl.ListFormat` throws on any item that isn’t a string, while a
 * value read from a file, e.g. a Select or Relation field value, may be a number or `null`, so the
 * items are stringified, and `null` and `undefined` dropped, before they are formatted.
 * @param {InternalLocaleCode} locale Locale code.
 * @param {Partial<Intl.ListFormatOptions>} options Format options.
 * @returns {ListFormatter} Formatter.
 */
export const getListFormatter = (locale, options = {}) => {
  const effectiveOptions = /** @type {Intl.ListFormatOptions} */ ({
    style: 'narrow',
    type: 'conjunction',
    ...options,
  });

  const cacheKey = `${locale}|${effectiveOptions.style}|${effectiveOptions.type}`;

  return getOrCreate(listFormatterCache, cacheKey, () => {
    const formatter = new Intl.ListFormat(getCanonicalLocale(locale), effectiveOptions);

    return {
      /**
       * Format the given list.
       * @param {Iterable<any>} list List items.
       * @returns {string} Formatted list.
       */
      format: (list) =>
        formatter.format(
          [...list].filter((item) => item !== null && item !== undefined).map((item) => `${item}`),
        ),
    };
  });
};

/**
 * Get the complete path for the given collection folder or file, including the locale.
 * @param {object} args Arguments.
 * @param {InternalI18nOptions} args._i18n I18n configuration.
 * @param {InternalLocaleCode} args.locale Locale code.
 * @param {string} args.path Collection folder or file path with the `{{locale}}` placeholder.
 * @returns {string} Complete path, including the locale.
 */
export const getLocalePath = ({ _i18n, locale, path }) => {
  const { defaultLocale, omitDefaultLocaleFromFilePath } = _i18n;

  return fillLocalePlaceholder({
    path,
    locale,
    // Remove the default locale from the path (for Zola compatibility)
    omitLocale: omitDefaultLocaleFromFilePath && locale === defaultLocale,
  });
};
