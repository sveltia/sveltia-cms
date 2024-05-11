import { initLocales } from '@sveltia/ui';
import { addMessages, getLocaleFromNavigator } from 'svelte-i18n';

/**
 * Load strings and initialize the locales.
 * @see https://github.com/kaisermann/svelte-i18n/blob/main/docs/Getting%20Started.md
 * @see https://vitejs.dev/guide/features.html#glob-import
 */
export const initAppLocale = () => {
  /**
   * @type {Record<string, { strings: object }>}
   */
  const modules = import.meta.glob('$lib/locales/*.js', { eager: true });

  Object.entries(modules).forEach(([path, { strings }]) => {
    const [, locale] = path.match(/([a-zA-Z-]+)\.js/) ?? [];

    addMessages(locale, /** @type {any} */ (strings));
  });

  initLocales({
    fallbackLocale: 'en',
    initialLocale: (getLocaleFromNavigator() ?? '').split('-')[0] || 'en',
  });
};
