import { untrack } from 'svelte';

import { getValueMapVersion } from '$lib/services/contents/draft/create/proxy.svelte';
import { updateComputedValues } from '$lib/services/contents/draft/update/compute';

/**
 * @import { EntryDraft } from '$lib/types/private';
 */

/**
 * Resolve the Compute fields of the given draft, and make the calling effect depend on everything
 * they can be computed from, so it runs again whenever a value changes. Call it from an `$effect`
 * of the editor holding the draft: the fields are resolved there rather than in their own editors,
 * which only run while they are rendered — a collapsed or off-screen list item renders none of its
 * fields.
 * @param {EntryDraft} draft Entry draft.
 */
export const trackComputedValues = (draft) => {
  // Depend on every field value at the cost of one dependency per locale, without walking the
  // values: each value map proxy counts its writes
  Object.values(draft.currentValues).forEach(getValueMapVersion);
  // The extra values of rich text editor components are plain `$state` objects with no version,
  // so they have to be read to be tracked. They are few, so the walk is cheap
  Object.values(draft.extraValues).forEach((valueMap) => void $state.snapshot(valueMap));
  void $state.snapshot(draft.currentLocales);

  untrack(() => {
    updateComputedValues(draft);
  });
};
