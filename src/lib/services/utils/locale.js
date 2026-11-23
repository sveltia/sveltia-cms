import { getOrCreate } from '$lib/services/utils/cache';

/**
 * Cache of {@link getLikelyLocale} results, keyed by locale code. The codes come from the
 * configuration, the UI locale and the APIs’ supported locales, so there are only a few of them,
 * while some are looked up often, e.g. a label on every render.
 * @type {Map<string, Intl.Locale | undefined>}
 */
const likelyLocaleCache = new Map();

/**
 * Get the given locale with its likely subtags added, e.g. `zh-Hant-TW` for `zh-TW` and
 * `pa-Arab-PK` for `pa-PK`.
 * @param {string} locale Locale code.
 * @returns {Intl.Locale | undefined} Maximized locale, or `undefined` if the locale code is
 * invalid.
 */
export const getLikelyLocale = (locale) =>
  getOrCreate(likelyLocaleCache, locale, () => {
    try {
      return new Intl.Locale(locale).maximize();
    } catch {
      return undefined;
    }
  });

/**
 * Get the language and the likely script of a locale, e.g. `zh-Hant` for `zh-TW` or `zh-HK`, and
 * `zh-Hans` for `zh` or `zh-SG`, so locales written in different scripts don’t match.
 * @param {string} locale Locale code.
 * @returns {string | undefined} Language and script, or `undefined` if the locale code is invalid.
 */
export const getLanguageScript = (locale) => {
  const likelyLocale = getLikelyLocale(locale);

  return likelyLocale && `${likelyLocale.language}-${likelyLocale.script}`;
};
