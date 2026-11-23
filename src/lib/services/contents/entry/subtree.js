import { isObject } from '@sveltia/utils/object';

import { getKeysByPrefix, isKeyPathWithin } from '$lib/services/contents/entry/key-paths';
import { flattenKeys, unflattenMap } from '$lib/services/utils/object';

/**
 * @import { FlattenedEntryContent } from '$lib/types/private';
 * @import { FieldKeyPath } from '$lib/types/public';
 */

/**
 * Check whether the value is an empty object or array, which a field holding a non-primitive value
 * stores at its own key path as a placeholder for the value its children make up.
 *
 * The placeholder is not redundant: `unflatten()` infers an array from numeric key segments, so it
 * is the placeholder that tells an object with the keys `0` and `1` apart from a two-item array. It
 * also keeps the field visible to validation when it holds no children at all.
 * @param {any} value Value to check.
 * @returns {boolean} Result.
 */
export const isPlaceholder = (value) =>
  (Array.isArray(value) && !value.length) || (isObject(value) && !Object.keys(value).length);

/**
 * Build the flat entries for a non-primitive value stored at the given key path: the placeholder
 * first, then one entry per leaf.
 *
 * The placeholder has to come first. `unflatten()` fills it in from the children when it is
 * encountered before them, but lets it overwrite them when it comes last.
 * @param {FieldKeyPath} keyPath Key path of the field.
 * @param {any[] | Record<string, any>} value Value to store.
 * @returns {FlattenedEntryContent} Flat entries.
 */
export const getSubtreeEntries = (keyPath, value) => ({
  [keyPath]: Array.isArray(value) ? [] : {},
  // Escape the object keys, so a key with a dot, e.g. in a KeyValue field in a list item, isn’t
  // split into nested objects on save
  ...flattenKeys(value, keyPath),
});

/**
 * Assemble the non-primitive value stored under the given key path from its child key paths.
 * @param {FlattenedEntryContent} valueMap Flattened entry content.
 * @param {FieldKeyPath} keyPath Key path of the field.
 * @param {object} [options] Options.
 * @param {boolean} [options.live] Whether the value map may be mutated after this call. See
 * {@link getKeysByPrefix}.
 * @returns {any} Assembled value, or `undefined` if the key path has no children.
 */
export const getSubtree = (valueMap, keyPath, { live = false } = {}) => {
  const keys = getKeysByPrefix(valueMap, `${keyPath}.`, { live });

  if (!keys.length) {
    return undefined;
  }

  // Wrap everything under a single root key, because `unflatten()` only builds an array from
  // numeric key segments when they are nested, not when they are at the top level
  const entries = keys.map((key) => [`_${key.slice(keyPath.length)}`, valueMap[key]]);
  const placeholder = valueMap[keyPath];

  if (isPlaceholder(placeholder)) {
    entries.push(['_', placeholder]);
  }

  return unflattenMap(Object.fromEntries(entries))._;
};

/**
 * What {@link getMemoizedSubtree} last built, and from what.
 * @typedef {object} SubtreeMemo
 * @property {FieldKeyPath} [keyPath] Key path of the field.
 * @property {FieldKeyPath[]} [keys] Child key paths.
 * @property {any[]} [values] Values of the child key paths and the field’s own key path, in that
 * order, with an object or array replaced with its kind, as {@link getSubtree} fills a placeholder
 * in place.
 * @property {any} [subtree] Assembled value.
 */

/**
 * Get a value of the given key path that can be compared across calls: an object or array, such as
 * a placeholder, is replaced with its kind.
 * @param {any} value Value.
 * @returns {any} Comparable value.
 */
const getComparableValue = (value) =>
  value !== null && typeof value === 'object' ? (Array.isArray(value) ? '\0[]' : '\0{}') : value;

/**
 * Same as {@link getSubtree}, but hands back the value assembled last time, as the same object, if
 * nothing under the key path has changed since. A List field’s editor and preview read the items
 * from the value map snapshot, which is replaced whenever any value in the entry changes, e.g. on
 * every keystroke in another field; assembling the items again each time is the bulk of the work in
 * a long entry, and a new object would make everything that reads them update as well.
 * @param {SubtreeMemo} memo Object holding what was built last time, kept by the caller and updated
 * in place.
 * @param {FlattenedEntryContent} valueMap Flattened entry content. A snapshot, as with
 * {@link getSubtree} without the `live` option.
 * @param {FieldKeyPath} keyPath Key path of the field.
 * @returns {any} Assembled value, or `undefined` if the key path has no children.
 */
export const getMemoizedSubtree = (memo, valueMap, keyPath) => {
  const keys = getKeysByPrefix(valueMap, `${keyPath}.`);
  const values = [...keys, keyPath].map((key) => getComparableValue(valueMap[key]));
  // The key paths and values are set along with the key path
  const lastKeys = /** @type {FieldKeyPath[]} */ (memo.keys);
  const lastValues = /** @type {any[]} */ (memo.values);

  if (
    memo.keyPath === keyPath &&
    lastKeys.length === keys.length &&
    keys.every((key, index) => key === lastKeys[index]) &&
    values.every((value, index) => value === lastValues[index])
  ) {
    return memo.subtree;
  }

  Object.assign(memo, { keyPath, keys, values, subtree: getSubtree(valueMap, keyPath) });

  return memo.subtree;
};

/**
 * Delete the value stored at the given key path along with everything below it. The map is modified
 * in place.
 * @param {FlattenedEntryContent} valueMap Flattened entry content.
 * @param {FieldKeyPath} keyPath Key path of the field.
 */
export const deleteSubtree = (valueMap, keyPath) => {
  Object.keys(valueMap).forEach((key) => {
    if (isKeyPathWithin(key, keyPath)) {
      delete valueMap[key];
    }
  });
};

/**
 * Replace the non-primitive value stored at the given key path. The existing subtree is dropped
 * first, so that keys the new value doesn’t have don’t linger. The map is modified in place.
 * @param {FlattenedEntryContent} valueMap Flattened entry content.
 * @param {FieldKeyPath} keyPath Key path of the field.
 * @param {any[] | Record<string, any>} value Value to store.
 */
export const setSubtree = (valueMap, keyPath, value) => {
  deleteSubtree(valueMap, keyPath);
  Object.assign(valueMap, getSubtreeEntries(keyPath, value));
};
