import { locale as appLocale, locales as appLocales, dictionary, waitLocale } from '@sveltia/i18n';
import { LocalStorage } from '@sveltia/utils/storage';
import equal from 'fast-deep-equal';
import { untrack } from 'svelte';

/**
 * @import { Preferences } from '$lib/types/private';
 */

/**
 * Local storage key for the user preferences. Also used by the i18n service, which reads the
 * language preference synchronously before the preferences below are loaded.
 */
export const PREFS_STORAGE_KEY = 'sveltia-cms.prefs';

/**
 * Preference value that makes the UI follow a browser or system setting instead of an explicit
 * choice. It’s the default for both the theme and the language, the latter also being what the
 * legacy `en` locale value is migrated to.
 */
export const AUTO_PREF_VALUE = 'auto';

/**
 * @type {{ current: { type: string } | undefined }}
 */
export const prefsError = $state({ current: undefined });

/**
 * Current user preferences as reactive state.
 * @type {Preferences}
 */
export const prefs = $state({});

/**
 * Whether the stored locale preference has been applied to the app locale.
 */
let storedLocaleApplied = false;

/**
 * Locale that best matches the browser’s language settings, used while the language preference is
 * {@link AUTO_PREF_VALUE}. It’s populated by `initAppLocale()` and kept up to date there, so that
 * the UI follows a change to those settings without a page reload.
 * @type {{ current: string | undefined }}
 */
export const navigatorLocale = $state({ current: undefined });

$effect.root(() => {
  (async () => {
    prefsError.current = undefined;

    try {
      const _prefs = (await LocalStorage.get(PREFS_STORAGE_KEY)) ?? {};

      _prefs.apiKeys ??= {};
      _prefs.useDraftBackup ??= true;
      _prefs.closeOnSave ??= true;
      _prefs.closeWithEscape ??= true;
      _prefs.underlineLinks ??= true;
      _prefs.beta ??= false;
      _prefs.devModeEnabled ??= false;
      _prefs.defaultTranslationService ??= 'google';
      _prefs.locale ??= AUTO_PREF_VALUE;

      // Migrate the legacy `en` value, which predates the regional English variants and used to be
      // resolved from the browser’s language settings anyway
      if (_prefs.locale === 'en') {
        _prefs.locale = AUTO_PREF_VALUE;
      }

      Object.assign(prefs, _prefs);
    } catch {
      prefsError.current = { type: 'permission_denied' };
    }
  })();

  $effect(() => {
    if (!Object.keys(prefs).length) {
      return;
    }

    const snapshot = $state.snapshot(prefs);

    (async () => {
      try {
        if (!equal(snapshot, await LocalStorage.get(PREFS_STORAGE_KEY))) {
          await LocalStorage.set(PREFS_STORAGE_KEY, snapshot);
        }
      } catch {
        //
      }
    })();

    const { theme, underlineLinks = true, beta = false, devModeEnabled: devMode = false } = prefs;
    const autoTheming = !theme || theme === AUTO_PREF_VALUE;
    const autoTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

    Object.assign(document.documentElement.dataset, {
      theme: autoTheming ? autoTheme : theme,
      autoTheming,
      underlineLinks,
      beta,
      devMode,
    });
  });

  // Keep this separate from the effect above, so that switching the app locale is not retried
  // whenever an unrelated preference is updated. A retry can be costly, because the strings for a
  // locale that failed to load are fetched from the CDN again.
  $effect(() => {
    const { locale: localePref } = prefs;
    const locale = localePref === AUTO_PREF_VALUE ? navigatorLocale.current : localePref;

    if (!locale || !appLocales.includes(locale)) {
      return;
    }

    // Don’t track the current locale, which would make this effect re-run on every locale change
    const previousLocale = untrack(() => appLocale.current);
    // Whether the user picked the language, as opposed to the stored preference being applied on
    // startup or the browser’s language settings changing. A failed switch is reverted, while a
    // stored preference or an automatic switch is kept, the former so that it can be retried on the
    // next visit, the latter so that the language keeps following the browser
    const switchedByUser = storedLocaleApplied && localePref !== AUTO_PREF_VALUE;

    storedLocaleApplied = true;

    // Load the strings first if the locale is not bundled with the app, so the UI won’t briefly
    // fall back to the default locale. The loader is registered in `initAppLocale()`.
    waitLocale(locale).then(() => {
      if (locale in dictionary) {
        appLocale.set(locale);
      } else if (switchedByUser && previousLocale) {
        // The strings couldn’t be loaded, so keep using the language the user already had instead
        // of falling back to the default locale
        prefs.locale = previousLocale;
      }
    });
  });
});
