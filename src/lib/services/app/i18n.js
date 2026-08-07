import {
  addMessages,
  locale as appLocale,
  getLocaleFromNavigator,
  init,
  register,
} from '@sveltia/i18n';
import { strings as componentStrings } from '@sveltia/ui';
import defaultComponentStrings from '@sveltia/ui/locales/en-US.yaml';
import { getPathInfo } from '@sveltia/utils/file';
import { LocalStorage } from '@sveltia/utils/storage';
import { toStore, writable } from 'svelte/store';

import defaultLocaleStrings from '$lib/locales/en-US.yaml';
import { UNPKG_BASE_URL, version } from '$lib/services/app';
import { prefs } from '$lib/services/user/prefs.svelte';

/**
 * @import { Readable, Writable } from 'svelte/store';
 */

/**
 * Default application locale. This is the only locale bundled with the app; the strings for the
 * other locales are loaded from the CDN on demand.
 */
export const DEFAULT_APP_LOCALE = 'en-US';

/**
 * List of all the available application locales, injected by Vite at build time based on the file
 * names in the `$lib/locales` directory.
 * @type {string[]}
 */
export const APP_LOCALES = import.meta.env.VITE_APP_LOCALES.split(',');

/**
 * Base URL for the JSON locale files published to the UNPKG CDN. These files are generated at build
 * time by the `generate-extra-files` Vite plugin.
 */
const REMOTE_LOCALES_BASE_URL = `${UNPKG_BASE_URL}@${version}/locales`;
/**
 * How long to wait for a remote locale file, in milliseconds. If the CDN is slow or unreachable, we
 * give up rather than blocking the app, and the strings fall back to {@link DEFAULT_APP_LOCALE}.
 */
const REMOTE_LOCALE_FETCH_TIMEOUT = 5000;
/**
 * Local storage key for the cached locale strings. Only one locale is cached at a time, given that
 * users rarely switch languages.
 */
const LOCALE_CACHE_KEY = 'sveltia-cms.locale';

/**
 * Current application locale as a Svelte store, derived from `locale` of `sveltia-i18n`.
 * @type {Readable<string>}
 */
export const appLocaleStore = toStore(() => appLocale.current);

/**
 * Locale being loaded from the CDN, if any. Bundled locales are switched instantly, so this is only
 * set while a remote locale file is being fetched.
 * @type {Writable<string | undefined>}
 */
export const appLocaleLoading = writable();

/**
 * Locale that couldn’t be loaded from the CDN, if any. A new object is stored for each failure, so
 * that retrying the same locale still triggers a new notification.
 * @type {Writable<{ locale: string } | undefined>}
 */
export const appLocaleLoadError = writable();

/**
 * Get the cached strings for the given locale from the local storage. The cache is discarded when
 * the locale or the app version doesn’t match, as the strings can change with each release.
 * @param {string} locale Locale code.
 * @returns {Promise<Record<string, any> | undefined>} Strings, or `undefined` if the cache is
 * unavailable, empty or stale.
 */
const getCachedLocaleStrings = async (locale) => {
  try {
    const { _locale, _version, ...strings } = (await LocalStorage.get(LOCALE_CACHE_KEY)) ?? {};

    if (_locale === locale && _version === version && Object.keys(strings).length) {
      return strings;
    }
  } catch {
    // The local storage may be unavailable, e.g. when cookies are blocked
  }

  return undefined;
};

/**
 * Cache the strings for the given locale in the local storage, overwriting the previously cached
 * locale, if any.
 * @param {string} locale Locale code.
 * @param {Record<string, any>} strings Strings.
 */
const cacheLocaleStrings = async (locale, strings) => {
  try {
    await LocalStorage.set(LOCALE_CACHE_KEY, { _locale: locale, _version: version, ...strings });
  } catch {
    // The local storage may be unavailable or the quota may be exceeded
  }
};

/**
 * Fetch the strings for the given locale from the CDN. The remote JSON files already contain the
 * Sveltia UI strings under the `_sui` key, so no merge is needed here.
 * @param {string} locale Locale code.
 * @returns {Promise<Record<string, any>>} Strings.
 * @throws {Error} When the file cannot be fetched within {@link REMOTE_LOCALE_FETCH_TIMEOUT}.
 */
const fetchLocaleStrings = async (locale) => {
  const response = await fetch(`${REMOTE_LOCALES_BASE_URL}/${locale}.json`, {
    signal: AbortSignal.timeout(REMOTE_LOCALE_FETCH_TIMEOUT),
  });

  if (!response.ok) {
    throw new Error(`Failed to load the ${locale} locale strings`, { cause: response });
  }

  return response.json();
};

/**
 * Load the strings for the given locale, from the local storage cache if possible, or from the CDN
 * otherwise. A cache hit is instant, so no loading notification is shown in that case.
 * @param {string} locale Locale code.
 * @returns {Promise<Record<string, any>>} Strings.
 * @throws {Error} When the strings cannot be fetched.
 */
const loadLocaleStrings = async (locale) => {
  const cachedStrings = await getCachedLocaleStrings(locale);

  if (cachedStrings) {
    return cachedStrings;
  }

  appLocaleLoading.set(locale);

  try {
    const strings = await fetchLocaleStrings(locale);

    await cacheLocaleStrings(locale, strings);

    return strings;
  } catch (ex) {
    // Let the caller know about the failure, then rethrow so that `sveltia-i18n` falls back to the
    // default locale
    appLocaleLoadError.set({ locale });
    throw ex;
  } finally {
    appLocaleLoading.set(undefined);
  }
};

/**
 * Load strings and initialize the locales. The Sveltia CMS strings are merged with the Sveltia UI
 * strings, the latter being prefixed with `_sui` to avoid collision. Only the
 * {@link DEFAULT_APP_LOCALE} strings are bundled with the app to keep the bundle size small. The
 * other locales are registered without strings, and those strings are fetched from the CDN once the
 * locale is first used. During development, all the locales are bundled instead, so that new
 * translations can be tested without publishing them.
 * @see https://github.com/sveltia/sveltia-i18n
 * @see https://vitejs.dev/guide/features.html#glob-import
 */
export const initAppLocale = () => {
  if (import.meta.env.DEV) {
    // YAML files are transformed into JS objects by the `yamlToJS` Vite plugin at build time
    const modules = import.meta.glob('$lib/locales/*.yaml', { eager: true, import: 'default' });

    Object.entries(modules).forEach(([path, content]) => {
      const locale = getPathInfo(path).filename;

      addMessages(locale, {
        .../** @type {Record<string, any>} */ (content),
        _sui: componentStrings[locale] ?? {},
      });
    });
  } else {
    addMessages(DEFAULT_APP_LOCALE, {
      ...defaultLocaleStrings,
      _sui: defaultComponentStrings,
    });

    APP_LOCALES.filter((locale) => locale !== DEFAULT_APP_LOCALE).forEach((locale) => {
      // Register the locale without strings so it’s listed in the language switcher; the strings
      // are loaded lazily when the locale is activated with `waitLocale()` or `locale.set()`
      register(locale, () => loadLocaleStrings(locale));
    });
  }

  // `init()` triggers the loader for the initial locale, but we don’t wait for it: the app is
  // rendered with the default locale strings, which are always bundled, then switches to the
  // requested locale as soon as its strings are loaded
  init({
    fallbackLocale: DEFAULT_APP_LOCALE,
    initialLocale: prefs.locale || getLocaleFromNavigator() || DEFAULT_APP_LOCALE,
  });
};
