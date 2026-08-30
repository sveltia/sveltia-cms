/**
 * @import { FlattenedEntryContent } from '$lib/types/private';
 * @import { FieldKeyPath } from '$lib/types/public';
 */

/**
 * Our internal representation of an entry is a flat map from key path to value, so anything that
 * needs the values *under* a key path — a list’s items, an object’s subfields, a multi-value
 * field’s entries — has to look them up by key path shape.
 *
 * Doing that with a scan is O(keys) per field, and the editor renders one component per field, so a
 * large entry ends up O(fields × keys) on every keystroke. The helpers here index each value map
 * once instead, keyed by the map object itself: the draft hands out a fresh snapshot per update, so
 * an index is built at most once per keystroke and shared by every field reading from it, then
 * garbage-collected with the snapshot.
 *
 * An index is therefore only valid while the map it was built from is left alone. A caller reading
 * a map it also mutates — a draft’s live content rather than a snapshot of it — has to pass the
 * `live` option, or it would keep getting the key paths the map had the first time it was read.
 */

/**
 * Cache of key path indexes, keyed by the value map object. Each entry is the map’s key paths
 * sorted lexicographically and paired with their original position, so {@link getKeysByPrefix} can
 * binary-search a prefix range and still hand the matches back in insertion order.
 * @type {WeakMap<FlattenedEntryContent, [FieldKeyPath, number][]>}
 */
const sortedKeyCacheMap = new WeakMap();

/**
 * Get the value map’s key paths sorted lexicographically, each paired with its original position.
 * @param {FlattenedEntryContent} valueMap Flattened entry content.
 * @returns {[FieldKeyPath, number][]} Sorted key path/position pairs.
 */
const getSortedKeys = (valueMap) => {
  let sorted = sortedKeyCacheMap.get(valueMap);

  if (!sorted) {
    sorted = Object.keys(valueMap)
      .map((key, index) => /** @type {[FieldKeyPath, number]} */ ([key, index]))
      // Object keys are unique, so the two arguments are never equal
      .sort(([a], [b]) => (a < b ? -1 : 1));

    sortedKeyCacheMap.set(valueMap, sorted);
  }

  return sorted;
};

/**
 * Get the key paths starting with the given prefix, in the value map’s own (insertion) order.
 *
 * Lexicographic order puts every matching key in one contiguous run, so the first one can be found
 * by binary search; the matches are then restored to insertion order, which is what callers mean by
 * the “first” field under a key path.
 * @param {FlattenedEntryContent} valueMap Flattened entry content.
 * @param {string} prefix Key path prefix, e.g. `authors.0.`.
 * @param {object} [options] Options.
 * @param {boolean} [options.live] Whether the value map may be mutated after this call, in which
 * case the key paths are scanned instead of being read from — and memoized in — the index.
 * @returns {FieldKeyPath[]} Matching key paths.
 */
export const getKeysByPrefix = (valueMap, prefix, { live = false } = {}) => {
  if (live) {
    return Object.keys(valueMap).filter((key) => key.startsWith(prefix));
  }

  const sorted = getSortedKeys(valueMap);
  let low = 0;
  let high = sorted.length;

  // Find the leftmost key that isn’t ordered before the prefix
  while (low < high) {
    const mid = Math.floor((low + high) / 2);

    if (sorted[mid][0] < prefix) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  /** @type {[FieldKeyPath, number][]} */
  const matches = [];

  for (let i = low; i < sorted.length && sorted[i][0].startsWith(prefix); i += 1) {
    matches.push(sorted[i]);
  }

  return matches.sort(([, a], [, b]) => a - b).map(([key]) => key);
};

/**
 * Regular expression to split a list item key path into its parent key path and item index, e.g.
 * `authors.0` into `authors` and `0`. The parent is matched greedily, so `authors.0.tags.2` yields
 * `authors.0.tags`.
 */
const LIST_ITEM_KEY_REGEX = /^(?<parent>.+)\.\d+$/;
/**
 * Cache of list item key paths grouped by parent key path, keyed by the value map object.
 * @type {WeakMap<FlattenedEntryContent, Map<FieldKeyPath, FieldKeyPath[]>>}
 */
const listItemKeyCacheMap = new WeakMap();

/**
 * Get the key paths of the direct list items under the given key path, in value map order.
 *
 * This is the shape every multi-value field stores its values in — a List field’s items, but also a
 * multiple Relation or Select field — so the same index serves all of them.
 * @param {FlattenedEntryContent} valueMap Flattened entry content.
 * @param {FieldKeyPath} keyPath Key path of the list field.
 * @param {object} [options] Options.
 * @param {boolean} [options.live] Whether the value map may be mutated after this call, in which
 * case the key paths are scanned instead of being read from — and memoized in — the index.
 * @returns {FieldKeyPath[]} Item key paths, e.g. `['authors.0', 'authors.1']`.
 */
export const getListItemKeys = (valueMap, keyPath, { live = false } = {}) => {
  if (live) {
    return Object.keys(valueMap).filter(
      (key) => key.match(LIST_ITEM_KEY_REGEX)?.groups?.parent === keyPath,
    );
  }

  let index = listItemKeyCacheMap.get(valueMap);

  if (!index) {
    index = new Map();

    Object.keys(valueMap).forEach((key) => {
      const { parent } = key.match(LIST_ITEM_KEY_REGEX)?.groups ?? {};

      if (parent === undefined) {
        return;
      }

      const keys = /** @type {Map<FieldKeyPath, FieldKeyPath[]>} */ (index).get(parent);

      if (keys) {
        keys.push(key);
      } else {
        /** @type {Map<FieldKeyPath, FieldKeyPath[]>} */ (index).set(parent, [key]);
      }
    });

    listItemKeyCacheMap.set(valueMap, index);
  }

  return index.get(keyPath) ?? [];
};
