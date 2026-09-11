import { loadChunk } from '$lib/services/app/dependencies';
import { createRawState } from '$lib/services/utils/state.svelte';

/**
 * @typedef {{ createRoot: typeof import('react-dom/client').createRoot }} ReactDomModule
 */

/**
 * The `react-dom` chunk once loaded.
 * @type {ReactDomModule | undefined}
 */
let reactDom;
/**
 * Pending load, shared between callers.
 * @type {Promise<ReactDomModule> | undefined}
 */
let loadPromise;

/**
 * Whether `react-dom` has been loaded. Components that mount a React root synchronously can depend
 * on this to know when they can render.
 * @type {{ current: boolean }}
 */
export const reactDomLoaded = createRawState(false);

/**
 * Load `react-dom`. Only the Netlify/Decap CMS-compatible API renders React components — custom
 * field types, preview templates and editor component previews — so the library is kept out of the
 * main bundle and fetched as a separate chunk when one of those is registered or used. Calling this
 * again returns the same promise.
 * @returns {Promise<ReactDomModule>} The module.
 */
export const loadReactDom = async () => {
  loadPromise ??= (async () => {
    /** @type {ReactDomModule} */
    let module;

    try {
      module = await loadChunk('react-dom');
    } catch (error) {
      // Let a later call try again, e.g. once the network is back
      loadPromise = undefined;
      throw error;
    }

    reactDom = module;
    reactDomLoaded.current = true;

    return module;
  })();

  return loadPromise;
};

/**
 * Start loading `react-dom` in the background, so that it’s ready by the time a component needs it.
 * A failure is left for the eventual {@link loadReactDom} call to report, where it can be handled,
 * rather than surfacing as an unhandled rejection at registration time.
 */
export const preloadReactDom = () => {
  loadReactDom().catch(() => {
    // Reported when the library is actually needed
  });
};

/**
 * Get the loaded `react-dom` module. The caller is responsible for awaiting {@link loadReactDom}
 * first.
 * @returns {ReactDomModule} The module.
 * @throws {Error} If the library hasn’t been loaded yet.
 */
export const getReactDom = () => {
  if (!reactDom) {
    throw new Error('react-dom is not loaded yet. Call `loadReactDom()` first.');
  }

  return /** @type {ReactDomModule} */ (reactDom);
};

/* v8 ignore next */
/**
 * Forget the loaded module. Used in tests.
 */
export const _resetReactDom = () => {
  reactDom = undefined;
  loadPromise = undefined;
  reactDomLoaded.current = false;
};
