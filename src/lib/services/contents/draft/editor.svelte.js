import { setEntryDraftRoot } from '$lib/services/contents/draft/state.svelte';
import { trackComputedValues } from '$lib/services/contents/draft/update/compute-tracking.svelte';

/**
 * @import { EntryDraftState } from '$lib/services/contents/draft/state.svelte';
 */

/**
 * Wire up an editor holding the given entry draft state: register its root element, so rich text
 * editor components, which are mounted outside the component tree, can look the draft up through
 * the DOM rather than the context, and resolve the Compute fields of whichever draft is open. Call
 * it while initializing the editor component.
 * @param {() => EntryDraftState} getEntryDraft Function returning the entry draft state of the
 * editor.
 * @param {() => HTMLElement | undefined} getRoot Function returning the editor root element, which
 * is `undefined` until it’s bound.
 */
export const initEntryDraftEditor = (getEntryDraft, getRoot) => {
  $effect(() => {
    const root = getRoot();

    if (root) {
      setEntryDraftRoot(root, getEntryDraft());
    }
  });

  $effect(() => {
    const draft = getEntryDraft().current;

    if (draft) {
      trackComputedValues(draft);
    }
  });
};
