import { isReadonly } from '$lib/services/config/readonly';
import { getCollectionLabel } from '$lib/services/contents/collection';
import { getCollectionFilesByEntry } from '$lib/services/contents/collection/files';
import { getAssociatedCollections } from '$lib/services/contents/entry';
import { getEntrySummary } from '$lib/services/contents/entry/summary';

/**
 * @import { Entry, InternalCollection } from '$lib/types/private';
 */

/**
 * Check whether an entry is read-only, which is when the whole CMS is, or any collection or
 * collection file the entry belongs to is. An entry can appear in more than one collection, and it
 * can’t be rewritten through one while another locks it.
 * @param {Entry} entry Entry.
 * @returns {boolean} Result.
 */
export const isEntryReadonly = (entry) =>
  isReadonly() ||
  getAssociatedCollections(entry).some(
    (collection) =>
      isReadonly({ collection }) ||
      getCollectionFilesByEntry(collection, entry).some((collectionFile) =>
        isReadonly({ collection, collectionFile }),
      ),
  );

/**
 * Get the label naming an entry in a message about the read-only entries that block a change, e.g.
 * `Posts › Hello World`.
 * @param {Entry} entry Entry.
 * @param {InternalCollection} [collection] Collection the entry is shown under. Default: the first
 * collection the entry belongs to.
 * @returns {string} Label, or the entry slug if the entry belongs to no collection.
 */
export const getReadonlyEntryLabel = (entry, collection = getAssociatedCollections(entry)[0]) =>
  collection
    ? `${getCollectionLabel(collection)} › ${getEntrySummary(collection, entry)}`
    : entry.slug;
