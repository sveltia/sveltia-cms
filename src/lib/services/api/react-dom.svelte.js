import { untrack } from 'svelte';

import { immutableLoaded, loadImmutable } from '$lib/services/api/immutable';
import { createReactRoot, loadReactDom, reactDomLoaded } from '$lib/services/api/react-dom';

/**
 * @typedef {object} ReactRenderer
 * @property {boolean} ready Whether the React component can be rendered: `react-dom` and Immutable
 * have been loaded, and the container element is there. Reactive, so an effect checking it renders
 * the component once it’s ready.
 * @property {(node: import('react').ReactNode) => void} render Render a node into the container,
 * creating the root on the first render. Check {@link ReactRenderer.ready} first.
 */

/**
 * Render a React component into an element of a Svelte component, the way a custom field control
 * or preview is rendered: the component receives Immutable Maps, so both libraries are loaded on
 * mount, and the root is unmounted along with the Svelte component. Call it while initializing the
 * Svelte component, as it creates an effect.
 * @param {() => HTMLElement | undefined} getContainer Function returning the element to render
 * into, typically bound with `bind:this`.
 * @returns {ReactRenderer} Renderer.
 */
export const createReactRenderer = (getContainer) => {
  /**
   * React root, created on the first render. Not reactive, as the effect rendering the component
   * assigns it, and would otherwise run again right away.
   * @type {ReturnType<typeof createReactRoot> | undefined}
   */
  let root;

  // Like `onMount()`, which can only be called in a component
  $effect(() =>
    untrack(() => {
      // Both libraries are normally loaded by the time the editor opens, as
      // `CMS.registerFieldType()` starts loading them, but wait for them in any case; the effect
      // rendering the component does so once they’re there
      Promise.all([loadImmutable(), loadReactDom()]).catch((/** @type {Error} */ error) => {
        // eslint-disable-next-line no-console
        console.error(error);
      });

      return () => {
        root?.unmount();
      };
    }),
  );

  return {
    /**
     * Get whether the React component can be rendered.
     * @returns {boolean} Result.
     */
    get ready() {
      return immutableLoaded.current && reactDomLoaded.current && !!getContainer();
    },
    /**
     * Render a node into the container.
     * @param {import('react').ReactNode} node React node.
     */
    render: (node) => {
      root ??= createReactRoot(/** @type {HTMLElement} */ (getContainer()));
      root.render(node);
    },
  };
};
