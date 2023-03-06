import equal from 'deep-is';
import { locale as appLocale, locales } from 'svelte-i18n';
import { get, writable } from 'svelte/store';
import LocalStorage from '$lib/services/utils/local-storage';

const storageKey = 'sveltia-cms.prefs';

export const prefs = writable({}, (set) => {
  (async () => {
    const _prefs = (await LocalStorage.get(storageKey)) || {};

    _prefs.apiKeys ||= {};
    set(_prefs);
  })();
});

prefs.subscribe(async (newPrefs) => {
  if (!newPrefs || newPrefs.error || !Object.keys(newPrefs).length) {
    return;
  }

  if (!equal(newPrefs, LocalStorage.get(storageKey))) {
    LocalStorage.set(storageKey, newPrefs);
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
