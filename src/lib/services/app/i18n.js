import { initLocales } from '@sveltia/ui';
import { getPathInfo } from '@sveltia/utils/file';
import { get } from 'svelte/store';
import { addMessages, getLocaleFromNavigator } from 'svelte-i18n';
import { prefs } from '$lib/services/user/prefs';

/**
 * Load strings and initialize the locales.
 * @see https://github.com/kaisermann/svelte-i18n/blob/main/docs/Getting%20Started.md
 * @see https://vitejs.dev/guide/features.html#glob-import
 */
export const initAppLocale = () => {
  /** @type {Record<string, { strings: Record<string, string> }>} */
  const modules = import.meta.glob('$lib/locales/*.js', { eager: true });

  Object.entries(modules).forEach(([path, { strings }]) => {
    const locale = getPathInfo(path).filename;

    addMessages(locale, strings);
  });

  initLocales({
    fallbackLocale: 'en',
    initialLocale: get(prefs).locale || (getLocaleFromNavigator() ?? '').split('-')[0] || 'en',
  });
};
