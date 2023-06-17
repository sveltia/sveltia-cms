import equal from 'fast-deep-equal';
import { locale as appLocale, locales } from 'svelte-i18n';
import { get, writable } from 'svelte/store';
import LocalStorage from '$lib/services/utils/local-storage';

const storageKey = 'sveltia-cms.prefs';

/**
 * @type {import('svelte/store').Writable<Preferences>}
 */
export const prefs = writable({}, (set) => {
  (async () => {
    try {
      const _prefs = (await LocalStorage.get(storageKey)) || {};

      _prefs.apiKeys ||= {};
      set(_prefs);
    } catch {
      //
    }
  })();
});

prefs.subscribe(async (newPrefs) => {
  if (!newPrefs || newPrefs.error || !Object.keys(newPrefs).length) {
    return;
  }

  try {
    if (!equal(newPrefs, await LocalStorage.get(storageKey))) {
      await LocalStorage.set(storageKey, newPrefs);
    }
  } catch {
    //
  }

  const { locale, theme } = newPrefs;

  if (locale && get(locales).includes(locale)) {
    appLocale.set(locale);
  }

  const autoTheming = !theme || theme === 'auto';
  const autoTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

  Object.assign(document.documentElement.dataset, {
    theme: autoTheming ? autoTheme : theme,
    autoTheming,
  });
});
