import { createRawState } from '$lib/services/utils/state.svelte';

/**
 * @template T
 * @typedef {object} LazyModule
 * @property {{ current: boolean }} loaded Whether the module has been loaded. Components that
 * render synchronously can depend on this to know when they can render.
 * @property {() => Promise<T>} load Load the module. Calling this again returns the same promise;
 * a failed load isn’t remembered, so a later call can try again, e.g. once the network is back.
 * @property {() => void} preload Start loading the module in the background, so that it’s ready by
 * the time a component needs it. A failure is left for the eventual `load` call to report, where it
 * can be handled, rather than surfacing as an unhandled rejection.
 * @property {() => T} get Get the loaded module. The caller is responsible for awaiting `load`
 * first. Throws if the module hasn’t been loaded yet.
 * @property {() => void} reset Forget the loaded module. Used in tests.
 */

/**
 * Create a loader for a library that’s kept out of the main bundle and fetched on demand.
 * @template T
 * @param {object} args Arguments.
 * @param {() => Promise<T>} args.loader Function fetching the module.
 * @param {string} args.notLoadedMessage Error message thrown by `get` before the module is loaded.
 * @returns {LazyModule<T>} Loader.
 */
export const createLazyModule = ({ loader, notLoadedMessage }) => {
  /** @type {T | undefined} */
  let module;
  /** @type {Promise<T> | undefined} */
  let loadPromise;
  const loaded = createRawState(false);

  /**
   * Load the module.
   * @returns {Promise<T>} The module.
   */
  const load = async () => {
    loadPromise ??= (async () => {
      /** @type {T} */
      let result;

      try {
        result = await loader();
      } catch (error) {
        loadPromise = undefined;
        throw error;
      }

      module = result;
      loaded.current = true;

      return result;
    })();

    return loadPromise;
  };

  /**
   * Start loading the module in the background.
   */
  const preload = () => {
    load().catch(() => {
      // Reported when the library is actually needed
    });
  };

  /**
   * Get the loaded module.
   * @returns {T} The module.
   * @throws {Error} If the module hasn’t been loaded yet.
   */
  const get = () => {
    if (!module) {
      throw new Error(notLoadedMessage);
    }

    return /** @type {T} */ (module);
  };

  /**
   * Forget the loaded module.
   */
  const reset = () => {
    module = undefined;
    loadPromise = undefined;
    loaded.current = false;
  };

  return { loaded, load, preload, get, reset };
};
