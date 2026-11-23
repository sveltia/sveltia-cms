/**
 * Loaders of the locale files published with the package, keyed with the locale code. Empty here;
 * the npm build replaces this module with one that imports each file, see `publishedLocales()` in
 * `scripts/vite/npm-build.js`. The other builds fetch the same files from the CDN.
 * @type {Record<string, () => Promise<{ default: Record<string, any> }>>}
 */
export const PUBLISHED_LOCALE_LOADERS = {};
