import { LocalStorage } from '@sveltia/utils/storage';
import equal from 'fast-deep-equal';
import { locale as appLocale, locales as appLocales } from 'svelte-i18n';
import { get, writable } from 'svelte/store';

const storageKey = 'sveltia-cms.prefs';

/**
 * @type {import('svelte/store').Writable<{ type: string } | undefined>}
 */
export const prefsError = writable();
/**
 * @type {import('svelte/store').Writable<Preferences>}
 */
export const prefs = writable({}, (set) => {
  prefsError.set(undefined);

  (async () => {
    try {
      const _prefs = (await LocalStorage.get(storageKey)) ?? {};

      _prefs.apiKeys ??= {};
      _prefs.closeOnSave ??= true;
      _prefs.underlineLinks ??= true;
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

  const { locale, theme, underlineLinks = true, devModeEnabled = false } = newPrefs;

  if (locale && get(appLocales).includes(locale)) {
    appLocale.set(locale);
  }

  const autoTheming = !theme || theme === 'auto';
  const autoTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

  Object.assign(document.documentElement.dataset, {
    theme: autoTheming ? autoTheme : theme,
    autoTheming,
    underlineLinks,
    env: devModeEnabled ? 'dev' : 'prod',
  });
});
