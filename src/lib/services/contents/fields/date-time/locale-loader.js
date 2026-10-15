import { loadModule } from '$lib/services/app/dependencies';

/**
 * Load the data of a Day.js locale from UNPKG. The npm build replaces this module with
 * `locale-loader.npm.js`, which bundles the locale files instead. The ES module registers the
 * locale with the copy of Day.js it imports itself, which isn’t the bundled one, so the data is
 * taken from its default export.
 * @param {string} key Day.js locale key, e.g. `de` or `pt-br`.
 * @returns {Promise<ILocale>} Locale data.
 */
export const loadLocaleData = async (key) =>
  (await loadModule('dayjs', `esm/locale/${key}.js`)).default;
