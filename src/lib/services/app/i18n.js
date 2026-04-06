import { addMessages, getLocaleFromNavigator, init } from '@sveltia/i18n';
import { getPathInfo } from '@sveltia/utils/file';
import { get } from 'svelte/store';

import { prefs } from '$lib/services/user/prefs';

/**
 * Load strings and initialize the locales.
 * @see https://github.com/sveltia/sveltia-i18n
 * @see https://vitejs.dev/guide/features.html#glob-import
 */
export const initAppLocale = () => {
  // YAML files are transformed into JS objects by the `yamlToJson` Vite plugin at build time
  const modules = import.meta.glob('$lib/locales/*.yaml', { eager: true, import: 'default' });

  Object.entries(modules).forEach(([path, content]) => {
    const locale = getPathInfo(path).filename;

    addMessages(locale, /** @type {Record<string, any>} */ (content));
  });

  init({
    fallbackLocale: 'en',
    initialLocale: get(prefs).locale || (getLocaleFromNavigator() ?? '').split('-')[0] || 'en',
  });
};
