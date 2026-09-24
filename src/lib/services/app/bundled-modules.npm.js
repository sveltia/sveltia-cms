import encodeWebP from '@jsquash/webp/encode.js';
import markerIconURL from 'leaflet/dist/images/marker-icon-2x.png?url';

/**
 * Loaders of the third-party libraries used by the npm build, keyed with the package name. Most
 * are left to the consumer’s bundler, which emits each as a chunk loaded on demand, see
 * `NPM_EXTERNAL_PACKAGES` in `scripts/npm-build.js`; the codecs are bundled, as they need a fix
 * for webpack. The WebP encoder is imported statically: its module is tiny and only loads the
 * codecs on demand, while a chunk of its own would need Vite’s preload helper, making that a chunk
 * of its own as well.
 * @type {Record<string, () => Promise<any>>}
 */
export const BUNDLED_MODULE_LOADERS = {
  // eslint-disable-next-line jsdoc/require-jsdoc
  '@discourse/heic': () => import('@discourse/heic'),
  // eslint-disable-next-line jsdoc/require-jsdoc
  '@jsquash/webp': async () => ({ default: encodeWebP }),
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
};

/**
 * URL of the Leaflet map marker icon, bundled as an asset. Imported statically, so it doesn’t take
 * a chunk of its own.
 * @type {string | undefined}
 */
export const BUNDLED_MARKER_ICON_URL = markerIconURL;
