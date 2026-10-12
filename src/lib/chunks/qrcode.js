/**
 * Entry point of the `qrcode` chunk, built separately from the main bundle and loaded on demand,
 * as only the mobile sign-in dialog needs it. The package has no ES module build to load from a
 * CDN, so it’s bundled into one here. See `buildChunks()` in `vite.config.js`.
 */
export { toCanvas } from 'qrcode';
