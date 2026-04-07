import { addMessages, locale as appLocale, getLocaleFromNavigator, init } from '@sveltia/i18n';
import { getPathInfo } from '@sveltia/utils/file';
import { get, toStore } from 'svelte/store';

import { prefs } from '$lib/services/user/prefs';

/**
 * @import { Readable } from 'svelte/store';
 */

/**
 * Current application locale as a Svelte store, derived from `locale` of `sveltia-i18n`.
 * @type {Readable<string>}
 */
export const appLocaleStore = toStore(() => appLocale.current);

/**
 * Load strings and initialize the locales.
 * @see https://github.com/sveltia/sveltia-i18n
 * @see https://vitejs.dev/guide/features.html#glob-import
 */
export const initAppLocale = () => {
  // YAML files are transformed into JS objects by the `yamlToJS` Vite plugin at build time
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
