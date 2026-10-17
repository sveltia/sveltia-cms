import { getOrderFieldKey } from '$lib/services/contents/collection/entries/reorder/config';
import { isArrayFileCollection } from '$lib/services/contents/collection/predicates';

/**
 * @import { Entry, InternalEntryCollection } from '$lib/types/private';
 */

/**
 * Get a function that returns an entry’s position in the manual order: the value of the
 * collection’s `order` field, or the position in the array for a collection storing all the entries
 * in one file.
 * @param {InternalEntryCollection} collection Entry collection.
 * @returns {(entry: Entry) => number | undefined} Order value getter. It returns `undefined` for an
 * entry lacking a valid numeric value, or for every entry if the collection has no `order` field.
 */
export const getOrderValueGetter = (collection) => {
  // An entry collection storing all the entries in one file keeps them in the order of the array
  if (isArrayFileCollection(collection)) {
    return (entry) => entry.arrayIndex ?? 0;
  }

  const orderKey = getOrderFieldKey(collection);

  if (!orderKey) {
    return () => undefined;
  }

  const { defaultLocale } = collection._i18n;

  return (entry) => {
    const raw = entry.locales[defaultLocale]?.content?.[orderKey];

    // `Number()` turns `null` and a blank string into `0`, so only a number or a non-blank string
    // counts as a value; anything else is missing and sorts last
    const v =
      typeof raw === 'number' || (typeof raw === 'string' && raw.trim()) ? Number(raw) : NaN;

    return Number.isFinite(v) ? v : undefined;
  };
};

/**
 * Sort entries by the collection’s `order` field, or by their position in the array for a
 * collection storing all the entries in one file. Entries lacking a valid numeric value are placed
 * at the end while preserving their relative input order.
 * @param {Entry[]} entries Entries to sort.
 * @param {InternalEntryCollection} collection Entry collection.
 * @returns {Entry[]} New, sorted array.
 */
export const sortEntriesByOrderField = (entries, collection) => {
  const getOrderValue = getOrderValueGetter(collection);
  // Pre-compute each entry’s numeric order value once so the comparator — which runs O(N log N)
  // times — only does a cheap numeric comparison rather than re-walking the property chain.
  const keyed = entries.map((entry) => ({ entry, v: getOrderValue(entry) }));

  keyed.sort((a, b) => {
    if (a.v !== undefined && b.v !== undefined) return a.v - b.v;
    if (a.v !== undefined) return -1;
    if (b.v !== undefined) return 1;
    return 0;
  });

  return keyed.map(({ entry }) => entry);
};
