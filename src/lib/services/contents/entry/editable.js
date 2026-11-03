import { isCollectionIndexFile } from '$lib/services/contents/collection/entries/index-file';
import { isArrayFileCollection } from '$lib/services/contents/collection/predicates';
import { isEntryReadonly } from '$lib/services/contents/entry/readonly';

/**
 * @import { Entry, InternalEntryCollection } from '$lib/types/private';
 */

/**
 * Check whether an existing entry of an entry collection can be changed from a Relation field of
 * another entry and saved along with it. An entry stored in a file with the other entries of the
 * collection can’t, as two entries edited in the same file couldn’t be saved at once, nor can the
 * collection’s index file, which has fields of its own, or a read-only entry.
 * @param {InternalEntryCollection} collection Collection the entry belongs to.
 * @param {Entry} entry Entry.
 * @returns {boolean} Result.
 */
export const isEntryEditableAlong = (collection, entry) =>
  !isArrayFileCollection(collection) &&
  !isCollectionIndexFile(collection, entry) &&
  !isEntryReadonly(entry);
