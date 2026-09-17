import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
import { getOrderFieldKey } from '$lib/services/contents/collection/entries/reorder/config';

/**
 * @import { EntryDraft } from '$lib/types/private';
 */

/**
 * For new entries in reorder-enabled entry collections, assign a fresh manual sort order to the
 * draft’s current values: highest existing order + 1, or 1 if no entries have one yet. Doing this
 * at save time (rather than draft creation) makes the assignment race-safe even when a draft has
 * been backed up and restored after another entry took the previously computed value. Callers must
 * gate on `draft.isNew` and `draft.collection._type === 'entry'` themselves.
 * @param {EntryDraft} draft Draft to mutate in place.
 * @param {number} [offset] Number of entries already given an order that isn’t in the collection
 * yet, such as the entries added from a Relation field that are saved along with the entry being
 * edited. Each of them takes the next order, so the new one comes after them.
 */
export const assignManualSortOrder = (draft, offset = 0) => {
  const { collection, collectionFile, currentValues } = draft;
  const orderKey = getOrderFieldKey(collection);

  if (!orderKey) {
    return;
  }

  const { defaultLocale } = (collectionFile ?? collection)._i18n;

  const maxOrder = getEntriesByCollection(collection.name).reduce((max, entry) => {
    const value = Number(entry.locales[defaultLocale]?.content?.[orderKey]);

    return Number.isFinite(value) && value > max ? value : max;
  }, 0);

  const nextOrder = maxOrder + offset + 1;

  Object.values(currentValues).forEach((valueMap) => {
    valueMap[orderKey] = nextOrder;
  });
};
