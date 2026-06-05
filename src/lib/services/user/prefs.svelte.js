import { locale as appLocale, locales as appLocales } from '@sveltia/i18n';
import { LocalStorage } from '@sveltia/utils/storage';
import equal from 'fast-deep-equal';

/**
 * @import { Preferences } from '$lib/types/private';
 */

const STORAGE_KEY = 'sveltia-cms.prefs';

/**
 * @type {{ current: { type: string } | undefined }}
 */
export const prefsError = $state({ current: undefined });

/**
 * Current user preferences as reactive state.
 * @type {Preferences}
 */
export const prefs = $state({});

$effect.root(() => {
  (async () => {
    prefsError.current = undefined;

    try {
      const _prefs = (await LocalStorage.get(STORAGE_KEY)) ?? {};

      _prefs.apiKeys ??= {};
      _prefs.useDraftBackup ??= true;
      _prefs.closeOnSave ??= true;
      _prefs.closeWithEscape ??= true;
      _prefs.underlineLinks ??= true;
      _prefs.beta ??= false;
      _prefs.devModeEnabled ??= false;
      _prefs.defaultTranslationService ??= 'google';
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
        if (!equal(snapshot, await LocalStorage.get(STORAGE_KEY))) {
          await LocalStorage.set(STORAGE_KEY, snapshot);
        }
      } catch {
        //
      }
    })();

    const {
      locale,
      theme,
      underlineLinks = true,
      beta = false,
      devModeEnabled: devMode = false,
    } = prefs;

    if (locale && appLocales.includes(locale)) {
      appLocale.set(locale);
    }

    const autoTheming = !theme || theme === 'auto';
    const autoTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

    Object.assign(document.documentElement.dataset, {
      theme: autoTheming ? autoTheme : theme,
      autoTheming,
      underlineLinks,
      beta,
      devMode,
    });
  });
});
