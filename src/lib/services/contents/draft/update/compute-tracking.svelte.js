import { getValueMapVersion } from '$lib/services/contents/draft/create/versioned-map.svelte';
import { updateComputedValues } from '$lib/services/contents/draft/update/compute';
import { deferDraftWrite } from '$lib/services/contents/draft/update/deferred';

/**
 * @import { EntryDraft } from '$lib/types/private';
 */

/**
 * Drafts whose Compute fields are waiting to be resolved in a microtask, so the effect running more
 * than once before it fires still resolves them once.
 * @type {WeakSet<EntryDraft>}
 */
const pendingDrafts = new WeakSet();

/**
 * Resolve the Compute fields of the given draft, and make the calling effect depend on everything
 * they can be computed from, so it runs again whenever a value changes. Call it from an `$effect`
 * of the editor holding the draft: the fields are resolved there rather than in their own editors,
 * which only run while they are rendered — a collapsed or off-screen list item renders none of its
 * fields.
 *
 * The fields are resolved outside the effect, as computed values are written to the draft; see
 * {@link deferDraftWrite}.
 * @param {EntryDraft} draft Entry draft.
 */
export const trackComputedValues = (draft) => {
  // Depend on every field value, including those of rich text editor components, at the cost of
  // one dependency per locale, without walking the values: each value map proxy counts its writes
  [draft.currentValues, draft.extraValues].forEach((store) => {
    Object.values(store).forEach(getValueMapVersion);
  });
  void $state.snapshot(draft.currentLocales);

  if (pendingDrafts.has(draft)) {
    return;
  }

  pendingDrafts.add(draft);

  deferDraftWrite(() => {
    pendingDrafts.delete(draft);
    updateComputedValues(draft);
  });
};
