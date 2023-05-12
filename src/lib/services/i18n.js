import { initLocales } from '@sveltia/ui';
import { addMessages, locale as appLocale, getLocaleFromNavigator } from 'svelte-i18n';
import { get } from 'svelte/store';

/**
 * Load strings and initialize the locales.
 * @see https://github.com/kaisermann/svelte-i18n/blob/main/docs/Getting%20Started.md
 * @see https://vitejs.dev/guide/features.html#glob-import
 */
export const initAppLocale = () => {
  /** @type {{ [key: string]: { strings: object }}} */
  const modules = import.meta.glob('../locales/*.js', { eager: true });

  Object.entries(modules).forEach(([path, { strings }]) => {
    const [, locale] = path.match(/([a-zA-Z-]+)\.js/);

    addMessages(locale, strings);
  });

  initLocales({
    fallbackLocale: 'en',
    initialLocale: (getLocaleFromNavigator() || '').split('-')[0] || 'en',
  });
};

/**
 * Translate the given locale code in the application UI locale.
 * @param {string} locale Locale code like `en`.
 * @returns {string} Locale label like `English`. If the formatter raises an error, just return the
 * locale code as is.
 */
export const getLocaleLabel = (locale) => {
  try {
    return new Intl.DisplayNames(get(appLocale), { type: 'language' }).of(locale);
  } catch {
    return locale;
  }
};
