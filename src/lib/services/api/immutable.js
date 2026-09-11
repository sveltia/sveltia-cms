import { loadModule } from '$lib/services/app/dependencies';
import { createRawState } from '$lib/services/utils/state.svelte';

/**
 * @typedef {typeof import('immutable')} ImmutableModule
 */

/**
 * The Immutable.js module once loaded.
 * @type {ImmutableModule | undefined}
 */
let immutable;
/**
 * Pending load, shared between callers.
 * @type {Promise<ImmutableModule> | undefined}
 */
let loadPromise;

/**
 * Whether Immutable.js has been loaded. Components that build props synchronously can depend on
 * this to know when they can render.
 * @type {{ current: boolean }}
 */
export const immutableLoaded = createRawState(false);

/**
 * Load Immutable.js from the CDN. The library is only used for the Netlify/Decap CMS-compatible
 * API — custom field types, preview templates and event hooks receive Immutable Maps — so it’s
 * fetched when one of those is registered rather than shipped with every install. Calling this
 * again returns the same promise.
 * @returns {Promise<ImmutableModule>} The module.
 */
export const loadImmutable = async () => {
  loadPromise ??= (async () => {
    /** @type {ImmutableModule} */
    let module;

    try {
      module = await loadModule('immutable', 'dist/immutable.es.js');
    } catch (error) {
      // Let a later call try again, e.g. once the network is back
      loadPromise = undefined;
      throw error;
    }

    immutable = module;
    immutableLoaded.current = true;

    return module;
  })();

  return loadPromise;
};

/**
 * Start loading Immutable.js in the background, so that it’s ready by the time a component needs
 * it. A failure is left for the eventual {@link loadImmutable} call to report, where it can be
 * handled, rather than surfacing as an unhandled rejection at registration time.
 */
export const preloadImmutable = () => {
  loadImmutable().catch(() => {
    // Reported when the library is actually needed
  });
};

/**
 * Get the loaded Immutable.js module. The caller is responsible for awaiting {@link loadImmutable}
 * first; anything reachable from a custom field, preview template or event hook has done so.
 * @returns {ImmutableModule} The module.
 * @throws {Error} If the library hasn’t been loaded yet.
 */
export const getImmutable = () => {
  if (!immutable) {
    throw new Error('Immutable.js is not loaded yet. Call `loadImmutable()` first.');
  }

  return /** @type {ImmutableModule} */ (immutable);
};

/* v8 ignore next */
/**
 * Forget the loaded module. Used in tests.
 */
export const _resetImmutable = () => {
  immutable = undefined;
  loadPromise = undefined;
  immutableLoaded.current = false;
};
