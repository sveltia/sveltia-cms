import { dependencies, UNPKG_BASE_URL, version } from '$lib/services/app';

/**
 * URL of the script the CMS was loaded from, captured while it’s running. `document.currentScript`
 * is only set for a classic script, which the IIFE build is; the ES module build has
 * `import.meta.url` instead, which the bundler turns into `undefined` in the IIFE build. Neither is
 * available if the IIFE is given `type="module"`, which the CMS warns against.
 * @type {string | undefined}
 */
const scriptURL =
  (typeof document === 'undefined'
    ? undefined
    : /** @type {HTMLScriptElement | null} */ (document.currentScript)?.src) || import.meta.url;

/**
 * Get the UNPKG CDN URL for the given dependency.
 * @param {string} name Dependency name.
 * @returns {string} URL.
 */
export const getUnpkgURL = (name) => {
  const url = `https://unpkg.com/${name}`;
  const libVersion = /** @type {Record<string, string>} */ (dependencies)[name]?.replace(/^\D/, '');

  return libVersion ? `${url}@${libVersion}` : url;
};

/**
 * Loaders of the third-party libraries bundled with the npm build, which is code-split so that the
 * consumer’s bundler can emit each library as its own chunk. Empty in the CDN builds, which load
 * them from UNPKG instead.
 * @type {Record<string, () => Promise<any>>}
 */
const npmModuleLoaders = import.meta.env.NPM_BUILD
  ? {
      // eslint-disable-next-line jsdoc/require-jsdoc
      '@discourse/heic': () => import('@discourse/heic'),
      // eslint-disable-next-line jsdoc/require-jsdoc
      '@jsquash/webp': () => import('@jsquash/webp/encode.js'),
      // eslint-disable-next-line jsdoc/require-jsdoc
      exifr: () => import('exifr/dist/lite.esm.mjs'),
      // eslint-disable-next-line jsdoc/require-jsdoc
      immutable: () => import('immutable'),
      // eslint-disable-next-line jsdoc/require-jsdoc
      leaflet: () => import('leaflet/dist/leaflet-src.esm.js'),
      // eslint-disable-next-line jsdoc/require-jsdoc
      svgo: () => import('svgo/browser'),
      // eslint-disable-next-line jsdoc/require-jsdoc
      'terra-draw': () => import('terra-draw'),
      // eslint-disable-next-line jsdoc/require-jsdoc
      'terra-draw-leaflet-adapter': () => import('terra-draw-leaflet-adapter'),
      // eslint-disable-next-line jsdoc/require-jsdoc
      turndown: () => import('turndown/lib/turndown.browser.es.js'),
    }
  : {};

/**
 * Load an ES module of a third-party library from UNPKG.
 * @param {string} library Library name.
 * @param {string} path Absolute path of the module file to be loaded without the leading slash.
 * @returns {Promise<any>} Module.
 */
export const loadModule = async (library, path) =>
  // The npm build has no fallback to UNPKG: webpack would take the variable specifier as a request
  // to bundle every file in the package
  import.meta.env.NPM_BUILD
    ? npmModuleLoaders[library]()
    : import(/* @vite-ignore */ `${getUnpkgURL(library)}/${path}`);

/**
 * Get the URL of the Leaflet map marker icon, which is bundled with the npm build as an asset.
 * @returns {Promise<string>} URL.
 */
export const getLeafletMarkerIconURL = async () =>
  import.meta.env.NPM_BUILD
    ? (await import('leaflet/dist/images/marker-icon-2x.png?url')).default
    : `${getUnpkgURL('leaflet')}/dist/images/marker-icon-2x.png`;

/**
 * Get the URLs a chunk of the CMS bundle can be loaded from, in order of preference: next to the
 * script the CMS itself was loaded from — which is where the npm package and the CDNs have it — and
 * failing that, the same release on UNPKG, for a site that only copied the main script.
 * @param {string} name Chunk name, e.g. `react-dom`.
 * @param {string} [base] URL of the CMS script, to resolve the sibling against. Defaults to the
 * running script’s URL, if known.
 * @returns {string[]} URLs.
 */
export const getChunkURLs = (name, base = scriptURL) => {
  const fileName = `chunks/${name}.js`;
  const fallback = `${UNPKG_BASE_URL}@${version}/dist/${fileName}`;

  if (!base) {
    return [fallback];
  }

  const sibling = new URL(fileName, base).href;

  // Loaded from UNPKG in the first place, the two are the same
  return sibling === fallback ? [fallback] : [sibling, fallback];
};

/**
 * Source entry of each chunk, for the development server, which serves the app as source modules
 * rather than a built bundle: there’s no built chunk next to the script there, so the entry is
 * imported through Vite instead. Empty in a production build, where this is removed along with the
 * imports, so the chunks stay out of the bundle.
 * @type {Record<string, () => Promise<any>>}
 */
const devChunkLoaders =
  import.meta.env.DEV || import.meta.env.NPM_BUILD
    ? {
        // eslint-disable-next-line jsdoc/require-jsdoc
        'react-dom': () => import('$lib/chunks/react-dom.js'),
      }
    : /* v8 ignore next */ {};

/**
 * Load a chunk of the CMS bundle: a part of the app that’s built separately and only fetched when
 * it’s needed, such as `react-dom` for the Netlify/Decap CMS-compatible API.
 * @param {string} name Chunk name, e.g. `react-dom`.
 * @returns {Promise<any>} Module.
 * @throws {Error} If the chunk can’t be loaded from any location.
 */
export const loadChunk = async (name) => {
  if (import.meta.env.NPM_BUILD || name in devChunkLoaders) {
    return devChunkLoaders[name]();
  }

  /** @type {unknown} */
  let lastError;

  // eslint-disable-next-line no-restricted-syntax
  for (const url of getChunkURLs(name)) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await import(/* @vite-ignore */ url);
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(`Failed to load the ${name} chunk.`, { cause: lastError });
};
