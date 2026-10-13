/**
 * Entry point of the `git` chunk, built separately from the main bundle and loaded on demand, as
 * only the local backend needs it, and only when the user has opted to commit their changes. The
 * package has no ES module build that loads from a CDN, as it imports CommonJS modules and expects
 * Node’s `Buffer`, so it’s bundled into one here with a `Buffer` polyfill. See `buildChunks()` in
 * `vite.config.js`.
 */
import './git/buffer.js';

export { Buffer } from 'buffer';
export { commit, currentBranch, getConfig, isIgnored, resolveRef } from 'isomorphic-git';
