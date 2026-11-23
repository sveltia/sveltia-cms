import { tick } from 'svelte';

import { trackPendingFieldUpdate } from '$lib/services/contents/editor/pending';

/**
 * Register a pending field editor update for as long as the editor holds a change made by the user
 * that it passes on to the entry draft with a short delay, e.g. a rich text editor converting the
 * content to Markdown, so a save right after a change doesn’t validate and write the previous
 * value. The update settles a tick after the editor is no longer pending, once the value has
 * reached the draft through the bindings and effects, or when the editor goes away. Call it while
 * initializing the editor component, as it creates an effect.
 * @param {() => boolean} getPending Function returning whether the editor holds such a change.
 */
export const trackPendingWhile = (getPending) => {
  $effect(() => {
    if (!getPending()) {
      return undefined;
    }

    /** @type {PromiseWithResolvers<void>} */
    const { promise, resolve } = Promise.withResolvers();

    trackPendingFieldUpdate(promise);

    return async () => {
      await tick();
      resolve();
    };
  });
};
