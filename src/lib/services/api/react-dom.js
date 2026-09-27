import { createLazyModule } from '$lib/services/api/lazy-module';
import { loadChunk } from '$lib/services/app/dependencies';

/**
 * @import { LazyModule } from '$lib/services/api/lazy-module';
 */

/**
 * @typedef {{ createRoot: typeof import('react-dom/client').createRoot }} ReactDomModule
 */

/**
 * Loader for `react-dom`. Only the Netlify/Decap CMS-compatible API renders React components —
 * custom field types, preview templates and editor component previews — so the library is kept out
 * of the main bundle and fetched as a separate chunk when one of those is registered or used.
 * @type {LazyModule<ReactDomModule>}
 */
const reactDom = createLazyModule({
  /**
   * Fetch the library chunk.
   * @returns {Promise<ReactDomModule>} The module.
   */
  loader: () => loadChunk('react-dom'),
  notLoadedMessage: 'react-dom is not loaded yet. Call `loadReactDom()` first.',
});

/**
 * Whether `react-dom` has been loaded. Components that mount a React root synchronously can depend
 * on this to know when they can render.
 */
export const reactDomLoaded = reactDom.loaded;
/**
 * Load `react-dom`. Calling this again returns the same promise.
 */
export const loadReactDom = reactDom.load;
/**
 * Start loading `react-dom` in the background, so that it’s ready by the time a component needs it.
 * A failure is left for the eventual {@link loadReactDom} call to report.
 */
export const preloadReactDom = reactDom.preload;
/**
 * Get the loaded `react-dom` module. The caller is responsible for awaiting {@link loadReactDom}
 * first.
 */
export const getReactDom = reactDom.get;
/**
 * Forget the loaded module. Used in tests.
 */
export const _resetReactDom = reactDom.reset;
