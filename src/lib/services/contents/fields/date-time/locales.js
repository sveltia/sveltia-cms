import dayjs from 'dayjs';
import dayjsLocales from 'dayjs/locale.json';

import { getOrCreate } from '$lib/services/utils/cache';

import { loadLocaleData } from './locale-loader.js';

/**
 * @import { InternalLocaleCode } from '$lib/types/private';
 * @import { DateTimeField } from '$lib/types/public';
 */

/**
 * Keys of the locales Day.js provides, e.g. `de` or `pt-br`.
 * @type {Set<string>}
 */
const DAYJS_LOCALE_KEYS = new Set(dayjsLocales.map(({ key }) => key));
/**
 * Keys of the locales registered with Day.js. English is built in.
 * @type {Set<string>}
 */
const loadedLocaleKeys = new Set(['en']);
/**
 * Pending loads of the Day.js locales, keyed with the locale key, so a locale is only requested
 * once.
 * @type {Map<string, Promise<void>>}
 */
const pendingLoads = new Map();
/**
 * Cache of {@link getDayjsLocaleKey} results, keyed with the locale code. The codes come from the
 * configuration, so there are only a few of them.
 * @type {Map<string, string | undefined>}
 */
const localeKeyCache = new Map();

/**
 * Get the Day.js locale that best matches the given locale code. The code is tried as is, then
 * with its parts removed from the end, e.g. `pt-BR`, then `pt`. A code with a script but no
 * region, like `zh-Hant`, is also tried with the region the script is most used in, `zh-TW`, before
 * the language alone, as Day.js has regional locales for the scripts rather than script ones.
 * @param {string} locale Locale code, e.g. `de` or `pt-BR`.
 * @returns {string | undefined} Day.js locale key, e.g. `de` or `pt-br`, or `undefined` if Day.js
 * doesn’t have the locale or the code is invalid.
 */
const findDayjsLocaleKey = (locale) => {
  /** @type {Intl.Locale} */
  let intlLocale;

  try {
    intlLocale = new Intl.Locale(locale);
  } catch {
    return undefined;
  }

  const { language, script, region } = intlLocale;
  const candidates = [locale.toLowerCase()];

  if (script && region) {
    candidates.push(`${language}-${script}-${region}`);
  }

  if (script) {
    candidates.push(`${language}-${script}`);
  }

  if (region) {
    candidates.push(`${language}-${region}`);
  }

  if (script && !region) {
    candidates.push(`${language}-${intlLocale.maximize().region}`);
  }

  candidates.push(language);

  return candidates
    .map((candidate) => candidate.toLowerCase())
    .find((candidate) => DAYJS_LOCALE_KEYS.has(candidate));
};

/**
 * Get the Day.js locale that best matches the given locale code, as {@link findDayjsLocaleKey}
 * does, with the result cached.
 * @param {string} locale Locale code, e.g. `de` or `pt-BR`.
 * @returns {string | undefined} Day.js locale key, or `undefined` if Day.js doesn’t have the locale
 * or the code is invalid.
 */
export const getDayjsLocaleKey = (locale) =>
  getOrCreate(localeKeyCache, locale, () => findDayjsLocaleKey(locale));

/**
 * Load and register the Day.js locale for the given key, if it hasn’t been yet. English is built
 * in, so it’s never loaded.
 * @param {string} key Day.js locale key.
 * @returns {Promise<void>} Promise that resolves once the locale is registered, or has failed to
 * load, in which case dates are written in English.
 */
const loadDayjsLocale = (key) => {
  if (loadedLocaleKeys.has(key)) {
    return Promise.resolve();
  }

  let promise = pendingLoads.get(key);

  if (!promise) {
    promise = (async () => {
      try {
        dayjs.locale(await loadLocaleData(key), undefined, true);
        loadedLocaleKeys.add(key);
      } catch (ex) {
        // eslint-disable-next-line no-console
        console.error(`Failed to load the Day.js locale “${key}”`, ex);
      } finally {
        pendingLoads.delete(key);
      }
    })();

    pendingLoads.set(key, promise);
  }

  return promise;
};

/**
 * Load the Day.js locales for the given locale codes, so dates can be formatted and parsed in them.
 * A code Day.js doesn’t have a locale for is ignored.
 * @param {Iterable<string>} locales Locale codes, e.g. `de` or `pt-BR`.
 * @returns {Promise<void>} Promise that resolves once all the locales have been loaded or failed.
 */
export const loadDayjsLocales = async (locales) => {
  const keys = new Set([...locales].map(getDayjsLocaleKey).filter((key) => key !== undefined));

  await Promise.all([...keys].map(loadDayjsLocale));
};

/**
 * Get the Day.js locale a DateTime field’s value is formatted and parsed in, as set with the
 * `localize_format` option: the given locale if `true`, or the one given as the option. A locale
 * that hasn’t been loaded, which Day.js doesn’t have or failed to load, falls back to English.
 * @param {DateTimeField} fieldConfig Field configuration.
 * @param {InternalLocaleCode} [locale] Locale of the content the value belongs to. `_default` if
 * i18n isn’t enabled for the content.
 * @returns {string | undefined} Day.js locale key, or `undefined` for English.
 */
export const getFormatLocale = (fieldConfig, locale) => {
  const { localize_format: localizeFormat } = fieldConfig;

  const code =
    typeof localizeFormat === 'string'
      ? localizeFormat
      : localizeFormat === true && locale && locale !== '_default'
        ? locale
        : undefined;

  if (!code) {
    return undefined;
  }

  const key = getDayjsLocaleKey(code);

  return key && key !== 'en' && loadedLocaleKeys.has(key) ? key : undefined;
};
