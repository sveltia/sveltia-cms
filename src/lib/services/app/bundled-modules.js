/**
 * Loaders of the third-party libraries used by the npm build, keyed with the package name. Empty
 * here; the npm build replaces this module with `bundled-modules.npm.js`. The CDN builds load the
 * libraries from UNPKG instead.
 * @type {Record<string, () => Promise<any>>}
 */
export const BUNDLED_MODULE_LOADERS = {};

/**
 * URL of the Leaflet map marker icon bundled with the npm build. `undefined` here, so the icon is
 * loaded from UNPKG.
 * @type {string | undefined}
 */
export const BUNDLED_MARKER_ICON_URL = undefined;
