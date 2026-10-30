import { saveChanges } from '$lib/services/backends/save';
import {
  contentUpdatesToast,
  UPDATE_TOAST_DEFAULT_STATE,
} from '$lib/services/contents/collection/data';

/**
 * @import { Entry, FileChange, InternalEntryCollection } from '$lib/types/private';
 */

/**
 * Commit changes made to existing entries of a collection from the entry list, like a bulk edit or
 * a new order, in a single commit, and tell the user how many entries were saved.
 * @param {object} args Arguments.
 * @param {InternalEntryCollection} args.collection Entry collection.
 * @param {FileChange[]} args.changes File changes to commit.
 * @param {Entry[]} args.savingEntries Entries being saved.
 * @returns {Promise<number>} Number of entries saved. `0` if there’s nothing to commit.
 */
export const saveEntryUpdates = async ({ collection, changes, savingEntries }) => {
  if (!changes.length) {
    return 0;
  }

  await saveChanges({
    changes,
    savingEntries,
    options: { commitType: 'update', collection },
  });

  contentUpdatesToast.current = {
    ...UPDATE_TOAST_DEFAULT_STATE,
    saved: true,
    count: savingEntries.length,
  };

  return savingEntries.length;
};
