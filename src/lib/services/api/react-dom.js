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

/**
 * Create a handle on a React root for the element, which is only created on the first render and
 * can be unmounted. `react-dom` must have been loaded, as for {@link getReactDom}.
 * @param {HTMLElement} element Element to render into.
 * @returns {{
 * render: (node: import('react').ReactNode) => void,
 * unmount: () => void,
 * }} Handle.
 */
export const createReactRoot = (element) => {
  /** @type {import('react-dom/client').Root | undefined} */
  let root;

  return {
    /**
     * Render a node, creating the root first if needed.
     * @param {import('react').ReactNode} node React node.
     */
    render: (node) => {
      root ??= reactDom.get().createRoot(element);
      root.render(node);
    },
    /**
     * Unmount the root, if it has been created.
     */
    unmount: () => {
      root?.unmount();
      root = undefined;
    },
  };
};

/**
 * Render a React node into the element once `react-dom` has been loaded, loading it if needed. The
 * returned function unmounts the node, and also keeps it from being rendered if the library is
 * still loading by then, e.g. because the element has been removed.
 * @param {HTMLElement} element Element to render into.
 * @param {import('react').ReactNode} node React node.
 * @returns {() => void} Function to unmount the node.
 */
export const mountReactNode = (element, node) => {
  /** @type {ReturnType<typeof createReactRoot> | undefined} */
  let handle;
  let detached = false;

  reactDom.load().then(
    () => {
      if (!detached) {
        handle = createReactRoot(element);
        handle.render(node);
      }
    },
    (/** @type {Error} */ error) => {
      // eslint-disable-next-line no-console
      console.error(error);
    },
  );

  return () => {
    detached = true;
    handle?.unmount();
  };
};
