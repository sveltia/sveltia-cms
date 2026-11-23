/**
 * Loaders of the Day.js locale files, keyed with the file path. Each file becomes a chunk of its
 * own, loaded on demand. Like the files loaded from UNPKG, the ES modules import a copy of Day.js
 * other than the app’s, which the CommonJS files would share: that would make the app’s Day.js a
 * chunk of its own, pulling much of the app out of the entry chunk with it.
 */
const LOADERS = /** @type {Record<string, () => Promise<ILocale>>} */ (
  import.meta.glob('/node_modules/dayjs/esm/locale/*.js', { import: 'default' })
);

/**
 * Load the data of a Day.js locale bundled with the npm build. Replaces `locale-loader.js`, which
 * loads the file from UNPKG.
 * @param {string} key Day.js locale key, e.g. `de` or `pt-br`.
 * @returns {Promise<ILocale>} Locale data.
 */
export const loadLocaleData = (key) => LOADERS[`/node_modules/dayjs/esm/locale/${key}.js`]();
