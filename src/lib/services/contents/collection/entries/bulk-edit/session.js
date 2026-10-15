import {
  isBulkEditableEntry,
  setBulkEditValue,
  validateBulkEdits,
} from '$lib/services/contents/collection/entries/bulk-edit';
import {
  bulkEditedEntries,
  bulkEditErrors,
  bulkEdits,
  entryGroups,
} from '$lib/services/contents/collection/view';

/**
 * @import { Entry, InternalEntryCollection } from '$lib/types/private';
 * @import { FieldKeyPath } from '$lib/types/public';
 */

/**
 * Take a snapshot of the entry groups of the current view when the bulk editor is opened, without
 * the entries that can’t be edited and the groups left empty, and publish the listed entries as
 * {@link bulkEditedEntries} for the toolbar Save button.
 * @param {InternalEntryCollection} collection Entry collection.
 * @returns {{ name: string, entries: Entry[] }[]} Entry groups.
 */
export const snapshotBulkEditGroups = (collection) => {
  const groups = entryGroups.current
    .map(({ name, entries }) => ({
      name,
      entries: entries.filter((entry) => isBulkEditableEntry(collection, entry)),
    }))
    .filter(({ entries }) => entries.length);

  bulkEditedEntries.current = groups.flatMap(({ entries }) => entries);

  return groups;
};

/**
 * Record a new value of a field in {@link bulkEdits}, and validate the edits again if the user has
 * been told some of them are invalid, so a fixed field stops being reported.
 * @param {object} args Arguments.
 * @param {InternalEntryCollection} args.collection Entry collection.
 * @param {Entry} args.entry Entry.
 * @param {FieldKeyPath} args.keyPath Field name.
 * @param {any} args.value New value.
 */
export const updateBulkEditValue = ({ collection, entry, keyPath, value }) => {
  bulkEdits.current = setBulkEditValue({
    collection,
    entry,
    keyPath,
    value,
    edits: bulkEdits.current,
  });

  if (Object.keys(bulkEditErrors.current).length) {
    bulkEditErrors.current = validateBulkEdits({
      collection,
      entries: bulkEditedEntries.current,
      edits: bulkEdits.current,
    });
  }
};
