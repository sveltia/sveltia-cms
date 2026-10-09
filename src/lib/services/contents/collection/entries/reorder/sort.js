import { getOrderFieldKey } from '$lib/services/contents/collection/entries/reorder/config';
import { isArrayFileCollection } from '$lib/services/contents/collection/predicates';

/**
 * @import { Entry, InternalEntryCollection } from '$lib/types/private';
 */

/**
 * Sort entries by the collection’s `order` field, or by their position in the array for a
 * collection storing all the entries in one file. Entries lacking a valid numeric value are placed
 * at the end while preserving their relative input order.
 * @param {Entry[]} entries Entries to sort.
 * @param {InternalEntryCollection} collection Entry collection.
 * @returns {Entry[]} New, sorted array.
 */
export const sortEntriesByOrderField = (entries, collection) => {
  // An entry collection storing all the entries in one file keeps them in the order of the array
  if (isArrayFileCollection(collection)) {
    return entries.toSorted((a, b) => (a.arrayIndex ?? 0) - (b.arrayIndex ?? 0));
  }

  const orderKey = getOrderFieldKey(collection);

  if (!orderKey) {
    return [...entries];
  }

  const { defaultLocale } = collection._i18n;

  // Pre-compute each entry’s numeric order value once so the comparator — which runs O(N log N)
  // times — only does a cheap numeric comparison rather than re-walking the property chain.
  const keyed = entries.map((entry) => {
    const raw = entry.locales[defaultLocale]?.content?.[orderKey];

    // `Number()` turns `null` and a blank string into `0`, so only a number or a non-blank string
    // counts as a value; anything else is missing and sorts last
    const v =
      typeof raw === 'number' || (typeof raw === 'string' && raw.trim()) ? Number(raw) : NaN;

    return { entry, v, has: Number.isFinite(v) };
  });

  keyed.sort((a, b) => {
    if (a.has && b.has) return a.v - b.v;
    if (a.has) return -1;
    if (b.has) return 1;
    return 0;
  });

  return keyed.map(({ entry }) => entry);
};
