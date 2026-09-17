import { getField } from '$lib/services/contents/entry/fields';
import { getSnapshot } from '$lib/services/utils/state.svelte';

/**
 * @import {
 * EntryDraft,
 * FlattenedEntryContent,
 * GetFieldArgs,
 * PendingEntry,
 * } from '$lib/types/private';
 */

/**
 * A set of values a pending entry can be referenced from.
 * @typedef {object} ValueSource
 * @property {FlattenedEntryContent} valueMap Flattened values.
 * @property {Omit<GetFieldArgs, 'keyPath' | 'valueMap'>} [fieldArgs] Arguments to look up the field
 * holding a value, so only a Relation field pointing at the entry’s collection counts. Omitted for
 * the values of rich text editor components, whose fields can’t be looked up by key path; any
 * matching value counts there.
 */

/**
 * Get the values the entry being edited holds: the field values in every locale, and the values of
 * the rich text editor components, which are stored apart.
 * @param {EntryDraft} draft Draft.
 * @returns {ValueSource[]} Value sources.
 */
const getDraftValueSources = ({
  collectionName,
  fileName,
  isIndexFile,
  currentValues,
  extraValues,
}) => [
  ...Object.values(currentValues).map((valueMap) => ({
    valueMap,
    fieldArgs: { collectionName, fileName, isIndexFile },
  })),
  ...Object.values(extraValues).map((valueMap) => ({ valueMap })),
];

/**
 * Get the values a pending entry holds in every locale, which is what a pending entry created from
 * a field of that entry is referenced by.
 * @param {PendingEntry} pendingEntry Pending entry.
 * @returns {ValueSource[]} Value sources.
 */
const getPendingEntryValueSources = ({ collectionName, entry }) =>
  Object.values(entry.locales).flatMap(({ content }) =>
    content ? [{ valueMap: content, fieldArgs: { collectionName } }] : [],
  );

/**
 * Check whether any of the given sources holds one of the values the pending entry goes by, in a
 * field that can refer to it. Two collections can have an entry going by the same value, e.g. a tag
 * and a category both stored by the slug `news`, so a value alone doesn’t tell which entry a field
 * refers to.
 * @param {ValueSource[]} sources Value sources to look in.
 * @param {PendingEntry} pendingEntry Pending entry.
 * @returns {boolean} Whether the entry is referenced.
 */
const isReferencedIn = (sources, { collectionName, values }) =>
  sources.some(({ valueMap, fieldArgs }) =>
    Object.entries(valueMap).some(([keyPath, value]) => {
      if (!values.includes(value)) {
        return false;
      }

      if (!fieldArgs) {
        return true;
      }

      const field = getField({ ...fieldArgs, valueMap, keyPath });

      // A value in a field that can’t be looked up is given the benefit of the doubt
      return !field || (field.widget === 'relation' && field.collection === collectionName);
    }),
  );

/**
 * Check whether the entry being edited still refers to the given pending entry. The entry was
 * created from a Relation field and selected there right away, so it’s only wanted as long as one
 * of the values it goes by is still held by a field in one of the locales, including a field of a
 * rich text editor component. A deselected entry is left out of the save rather than created for
 * nothing.
 * @param {EntryDraft} draft Draft the pending entry belongs to.
 * @param {PendingEntry} pendingEntry Pending entry.
 * @returns {boolean} Whether the entry is referenced.
 */
export const isPendingEntryReferenced = (draft, pendingEntry) =>
  isReferencedIn(getDraftValueSources(draft), pendingEntry);

/**
 * Get the pending entries of the given draft that are still referenced, so they can be saved along
 * with the entry. See {@link isPendingEntryReferenced}. A pending entry can also be referenced by
 * another pending entry rather than by the entry being edited, when it was created from a Relation
 * field of that entry’s quick-add dialog, so the referenced set is grown until no more entries are
 * reached, and one referenced only by a deselected entry is left out along with it.
 * @param {EntryDraft} draft Draft to save.
 * @returns {PendingEntry[]} Pending entries, in the order they were added, detached from the
 * reactive draft: they go into the entry and asset stores, whose consumers may clone them, which a
 * `$state` proxy can’t be.
 */
export const getReferencedPendingEntries = (draft) => {
  const sources = getDraftValueSources(draft);
  /** @type {Set<PendingEntry>} */
  const referenced = new Set();

  /**
   * Add the pending entries referenced by the sources collected so far.
   * @returns {boolean} Whether any entry has been added.
   */
  const grow = () => {
    const newlyReferenced = draft.pendingEntries.filter(
      (pendingEntry) => !referenced.has(pendingEntry) && isReferencedIn(sources, pendingEntry),
    );

    newlyReferenced.forEach((pendingEntry) => {
      referenced.add(pendingEntry);
      sources.push(...getPendingEntryValueSources(pendingEntry));
    });

    return newlyReferenced.length > 0;
  };

  while (grow()) {
    // Keep going until no more entries are reached
  }

  return draft.pendingEntries
    .filter((pendingEntry) => referenced.has(pendingEntry))
    .map((pendingEntry) => getSnapshot(pendingEntry));
};
