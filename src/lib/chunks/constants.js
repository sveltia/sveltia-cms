/**
 * Global property the main bundle shares its React instance on, for the `react-dom` chunk. Kept in
 * a module without dependencies, as it’s imported by the build configuration as well as the app, so
 * the two sides can’t drift apart.
 */
export const SHARED_REACT_KEY = '__SVELTIA_CMS_REACT__';

/**
 * Prefix of the global property the main bundle shares the modules the backend chunks import on,
 * as an array of modules, each an array of exports. The property name ends with the release
 * version and a hash of that layout, so a chunk built with another main bundle, e.g. one cached by
 * the browser from an earlier release, finds nothing. See `getSharedModulesKey()` in
 * `scripts/vite/chunks.js`.
 */
export const SHARED_MODULES_KEY_PREFIX = '__SVELTIA_CMS_MODULES_';
