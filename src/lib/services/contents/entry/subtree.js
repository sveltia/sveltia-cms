import { isObject } from '@sveltia/utils/object';
import { flatten } from 'flat';

import { getKeysByPrefix } from '$lib/services/contents/entry/key-paths';
import { unflattenMap } from '$lib/services/utils/object';

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
  ...Object.fromEntries(
    Object.entries(flatten(value)).map(([key, val]) => [`${keyPath}.${key}`, val]),
  ),
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
 * Delete the value stored at the given key path along with everything below it. The map is modified
 * in place.
 * @param {FlattenedEntryContent} valueMap Flattened entry content.
 * @param {FieldKeyPath} keyPath Key path of the field.
 */
export const deleteSubtree = (valueMap, keyPath) => {
  const prefix = `${keyPath}.`;

  Object.keys(valueMap).forEach((key) => {
    if (key === keyPath || key.startsWith(prefix)) {
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
