import { additionsComments } from '$lib/services/additions/comments.svelte';
import { getEarlierEntryPaths } from '$lib/services/contents/entry/earlier-paths';
import { getDraftEntryKey, getEntryKey } from '$lib/services/contents/entry/entry-key';

/**
 * @import { Entry, EntryDraft } from '$lib/types/private';
 */

/**
 * Get the keys an entry’s comments are still kept under, from before it was renamed outside the
 * CMS, e.g. with `git mv`, which leaves them where they were. A rename in the CMS moves them. The
 * earlier locations come from the URL aliases the entry keeps; see {@link getEarlierEntryPaths}.
 * Only the keys that have comments are given.
 * @param {EntryDraft | null | undefined} draft Entry draft.
 * @returns {string[]} Keys, other than the entry’s own.
 */
export const getConversationAliasKeys = (draft) => {
  if (!getDraftEntryKey(draft)) {
    return [];
  }

  const { collection, collectionName, fields, originalEntry } = /** @type {EntryDraft} */ (draft);

  return getEarlierEntryPaths({ collection, fields, entry: /** @type {Entry} */ (originalEntry) })
    .map(({ subPath }) => getEntryKey(collectionName, subPath))
    .filter((key) => !!additionsComments.counts[key]);
};
