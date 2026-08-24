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
import { PREFS_STORAGE_KEY } from '$lib/services/user/prefs.svelte';

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
 * Strings for the locales loaded during the session, keyed with the locale code. The `dictionary`
 * of `sveltia-i18n` holds compiled `Intl.MessageFormat` objects rather than the original strings,
 * so we keep our own copy to be able to update the cache later.
 * @type {Map<string, Record<string, any>>}
 */
const loadedLocaleStrings = new Map();

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
 * Discard the cached strings, whichever locale they belong to.
 */
const deleteCachedLocaleStrings = async () => {
  try {
    await LocalStorage.delete(LOCALE_CACHE_KEY);
  } catch {
    // The local storage may be unavailable
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
    loadedLocaleStrings.set(locale, cachedStrings);

    return cachedStrings;
  }

  appLocaleLoading.set(locale);

  try {
    const strings = await fetchLocaleStrings(locale);

    loadedLocaleStrings.set(locale, strings);
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
 * Update the local storage cache so that it holds the strings for the given locale, or no strings
 * at all if the locale is bundled with the app. `sveltia-i18n` calls a registered loader only once
 * per locale, so switching back to a language already used earlier in the session doesn’t go
 * through {@link loadLocaleStrings} again, leaving the cache pointing at another locale. Without
 * this, the strings would be fetched from the CDN again on the next visit.
 * @param {string} locale Locale code.
 */
export const updateLocaleCache = async (locale) => {
  const strings = loadedLocaleStrings.get(locale);

  if (!strings) {
    // The {@link DEFAULT_APP_LOCALE} strings are bundled with the app, so the cache is useless once
    // the user switches back to that locale. It’s only discarded after another locale has been
    // active in this session, so that a cache left by a previous session survives a startup where
    // the requested locale couldn’t be loaded and the app fell back to the default one.
    if (locale === DEFAULT_APP_LOCALE && loadedLocaleStrings.size) {
      await deleteCachedLocaleStrings();
    }

    // Anything else is a locale whose loader is still running; that loader caches the strings once
    // it’s done
    return;
  }

  // Avoid a redundant write when the cache is already up to date, e.g. right after a CDN fetch
  if (await getCachedLocaleStrings(locale)) {
    return;
  }

  await cacheLocaleStrings(locale, strings);
};

/**
 * Get the language preference stored in the local storage, if it points at an available locale.
 *
 * The preference is read here rather than taken from `prefs`, because the preferences are loaded
 * asynchronously and are therefore still empty when the app starts. Falling back to the browser’s
 * language in the meantime would activate a locale the user never asked for, fetch its strings from
 * the CDN, cache them, and then have {@link updateLocaleCache} overwrite or discard that cache once
 * the preference is finally applied — repeating on every visit. The `LocalStorage` wrapper is
 * `async`, but the underlying Web Storage API is synchronous, so the value is available right away.
 * @returns {string | undefined} Locale code, or `undefined` if there’s no usable preference.
 */
const getStoredLocale = () => {
  try {
    const { locale } = JSON.parse(globalThis.localStorage.getItem(PREFS_STORAGE_KEY) || '{}') ?? {};

    // Ignore a locale that’s no longer available, as well as the legacy `en` value, which is
    // migrated to a proper code once the preferences are loaded
    return APP_LOCALES.includes(locale) ? locale : undefined;
  } catch {
    // The local storage may be unavailable, e.g. when cookies are blocked, or the stored data may
    // be corrupt
    return undefined;
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
    initialLocale: getStoredLocale() || getLocaleFromNavigator() || DEFAULT_APP_LOCALE,
  });

  // Keep the cache in sync with the active locale, including when the language is switched with the
  // app settings. The subscription lives as long as the app, so it’s never cancelled.
  appLocaleStore.subscribe((locale) => {
    updateLocaleCache(locale);
  });
};
