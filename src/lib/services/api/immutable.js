import { createLazyModule } from '$lib/services/api/lazy-module';
import { loadModule } from '$lib/services/app/dependencies';

/**
 * @import { LazyModule } from '$lib/services/api/lazy-module';
 */

/**
 * @typedef {typeof import('immutable')} ImmutableModule
 */

/**
 * Loader for Immutable.js. The library is only used for the Netlify/Decap CMS-compatible API —
 * custom field types, preview templates and event hooks receive Immutable Maps — so it’s fetched
 * from the CDN when one of those is registered rather than shipped with every install.
 * @type {LazyModule<ImmutableModule>}
 */
const immutable = createLazyModule({
  /**
   * Fetch the library from the CDN.
   * @returns {Promise<ImmutableModule>} The module.
   */
  loader: () => loadModule('immutable', 'dist/immutable.es.js'),
  notLoadedMessage: 'Immutable.js is not loaded yet. Call `loadImmutable()` first.',
});

/**
 * Whether Immutable.js has been loaded. Components that build props synchronously can depend on
 * this to know when they can render.
 */
export const immutableLoaded = immutable.loaded;
/**
 * Load Immutable.js. Calling this again returns the same promise.
 */
export const loadImmutable = immutable.load;
/**
 * Start loading Immutable.js in the background, so that it’s ready by the time a component needs
 * it. A failure is left for the eventual {@link loadImmutable} call to report.
 */
export const preloadImmutable = immutable.preload;
/**
 * Get the loaded Immutable.js module. The caller is responsible for awaiting {@link loadImmutable}
 * first; anything reachable from a custom field, preview template or event hook has done so.
 */
export const getImmutable = immutable.get;
/**
 * Forget the loaded module. Used in tests.
 */
export const _resetImmutable = immutable.reset;
