import { dependencies, UNPKG_BASE_URL, version } from '$lib/services/app';
import { BUNDLED_MARKER_ICON_URL, BUNDLED_MODULE_LOADERS } from '$lib/services/app/bundled-modules';

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
 * Load an ES module of a third-party library from UNPKG.
 * @param {string} library Library name.
 * @param {string} path Absolute path of the module file to be loaded without the leading slash.
 * @returns {Promise<any>} Module.
 */
export const loadModule = async (library, path) =>
  // The npm build has no fallback to UNPKG: webpack would take the variable specifier as a request
  // to bundle every file in the package
  import.meta.env.NPM_BUILD
    ? BUNDLED_MODULE_LOADERS[library]()
    : import(/* @vite-ignore */ `${getUnpkgURL(library)}/${path}`);

/**
 * Get the URL of the Leaflet map marker icon, which is bundled with the npm build as an asset.
 * @returns {Promise<string>} URL.
 */
export const getLeafletMarkerIconURL = async () =>
  BUNDLED_MARKER_ICON_URL ?? `${getUnpkgURL('leaflet')}/dist/images/marker-icon-2x.png`;

/**
 * Hosts of the npm CDNs the CMS is typically loaded from, which serve the latest release when a URL
 * has no version.
 */
const NPM_CDN_HOSTS = ['unpkg.com', 'cdn.jsdelivr.net'];

/**
 * Parse the URL of the CMS script if it’s a CDN URL of the package without the exact version, e.g.
 * `https://unpkg.com/@sveltia/cms/dist/sveltia-cms.js` or
 * `https://cdn.jsdelivr.net/npm/@sveltia/cms@0/dist/sveltia-cms.js`. Such a URL serves the latest
 * matching release. A version range or tag counts on any host, as only a CDN would serve one, but a
 * URL without a version only on a known CDN, as a self-hosted copy can be anywhere, e.g. in
 * `node_modules/@sveltia/cms/dist`.
 * @param {string} url Script URL.
 * @returns {{ url: URL, packagePath: string, versionSpec?: string, filePath: string } | undefined}
 * Parsed URL with its parts, or `undefined` if it’s pinned to the running version or not a CDN URL.
 */
const parseUnpinnedScriptURL = (url) => {
  const parsedURL = new URL(url);
  const match = parsedURL.pathname.match(/^(.*\/@sveltia\/cms)(?:@([^/]*))?(\/.*)$/);

  if (!match) {
    return undefined;
  }

  const [, packagePath, versionSpec, filePath] = match;

  if (
    versionSpec === version ||
    (versionSpec === undefined && !NPM_CDN_HOSTS.includes(parsedURL.host))
  ) {
    return undefined;
  }

  return { url: parsedURL, packagePath, versionSpec, filePath };
};

/**
 * Pin the URL of the CMS script to the running version if it’s a CDN URL of the package without the
 * exact version (see {@link parseUnpinnedScriptURL}). Such a URL serves the latest matching
 * release, so a chunk resolved against it could come from a newer release than the script, e.g.
 * one cached in the browser from before the release.
 * @param {string} url Script URL.
 * @returns {string} Pinned URL, or the given one if it’s already pinned or not a CDN URL.
 */
const pinScriptURL = (url) => {
  const parsed = parseUnpinnedScriptURL(url);

  if (!parsed) {
    return url;
  }

  const { url: pinnedURL, packagePath, filePath } = parsed;

  // Only replace the path, so that the host stays the same whatever the path looks like
  pinnedURL.pathname = `${packagePath}@${version}${filePath}`;

  return pinnedURL.href;
};

/**
 * Get the version the CDN resolves the URL of the CMS script with, if it’s not pinned to the
 * running version (see {@link parseUnpinnedScriptURL}), so a reload may load a newer release.
 * @param {string} [url] Script URL. Defaults to the running script’s URL, if known.
 * @returns {string | undefined} Version range or tag as it appears in the URL, e.g. `^1` (which
 * may be percent-encoded) or `latest`, an empty string for a URL without a version, which serves
 * the latest release, or `undefined` if the URL is pinned, not a CDN URL or unknown, e.g. with the
 * npm package bundled into a site.
 */
export const getScriptVersionSpec = (url = scriptURL) => {
  const parsed = url ? parseUnpinnedScriptURL(url) : undefined;

  return parsed ? (parsed.versionSpec ?? '') : undefined;
};

/**
 * Get the URLs a chunk of the CMS bundle can be loaded from, in order of preference: next to the
 * script the CMS itself was loaded from — which is where the npm package and the CDNs have it — and
 * failing that, the same release on UNPKG, for a site that only copied the main script. A CDN URL
 * without the exact version is pinned to the running version first, so that the chunk comes from
 * the same release as the script.
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

  const sibling = new URL(fileName, pinScriptURL(base)).href;

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
        git: () => import('$lib/chunks/git.js'),
        // eslint-disable-next-line jsdoc/require-jsdoc
        gitea: () => import('$lib/chunks/gitea.js'),
        // eslint-disable-next-line jsdoc/require-jsdoc
        gitlab: () => import('$lib/chunks/gitlab.js'),
        // eslint-disable-next-line jsdoc/require-jsdoc
        qrcode: () => import('$lib/chunks/qrcode.js'),
        // eslint-disable-next-line jsdoc/require-jsdoc
        'react-dom': () => import('$lib/chunks/react-dom.js'),
      }
    : /* v8 ignore next */ {};

/**
 * Load a chunk of the CMS bundle: a part of the app that’s built separately and only fetched when
 * it’s needed, such as `react-dom` for the Netlify/Decap CMS-compatible API, `qrcode` for the
 * mobile sign-in dialog, `git` for the local backend’s Git commits, or `gitlab` and `gitea` for
 * those backends.
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
