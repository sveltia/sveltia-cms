import { LocalStorage } from '@sveltia/utils/storage';
import equal from 'fast-deep-equal';
import { locale as appLocale, locales as appLocales } from 'svelte-i18n';
import { get, writable } from 'svelte/store';

/**
 * @import { Writable } from 'svelte/store';
 * @import { Preferences } from '$lib/types/private';
 */

const storageKey = 'sveltia-cms.prefs';

/**
 * @type {Writable<{ type: string } | undefined>}
 */
export const prefsError = writable();
/**
 * @type {Writable<Preferences>}
 */
export const prefs = writable({}, (set) => {
  prefsError.set(undefined);

  (async () => {
    try {
      const _prefs = (await LocalStorage.get(storageKey)) ?? {};

      _prefs.apiKeys ??= {};
      _prefs.useDraftBackup ??= true;
      _prefs.closeOnSave ??= true;
      _prefs.closeWithEscape ??= true;
      _prefs.underlineLinks ??= true;
      _prefs.beta ??= false;
      _prefs.devModeEnabled ??= false;
      set(_prefs);
    } catch {
      prefsError.set({ type: 'permission_denied' });
    }
  })();
});

prefs.subscribe((newPrefs) => {
  if (!newPrefs || !Object.keys(newPrefs).length) {
    return;
  }

  (async () => {
    try {
      if (!equal(newPrefs, await LocalStorage.get(storageKey))) {
        await LocalStorage.set(storageKey, newPrefs);
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
  } = newPrefs;

  if (locale && get(appLocales).includes(locale)) {
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
