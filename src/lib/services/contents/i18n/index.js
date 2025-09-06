/**
 * @import { InternalI18nOptions, InternalLocaleCode, } from '$lib/types/private';
 * @import { LocaleCode } from '$lib/types/public';
 */

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

  const formatter = new Intl.DisplayNames(canonicalLocale, { type: 'language' });

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
