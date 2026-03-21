import { compare } from '@sveltia/utils/string';

import { getRegex } from '$lib/services/utils/misc';

/**
 * Build a sorted group map from a list of items.
 * @template T
 * @param {T[]} items Items to group.
 * @param {string | RegExp | boolean | undefined} pattern Pattern to extract the group key from each
 * value. When provided, the first match is used as the key; unmatched items fall back to
 * `otherKey`.
 * @param {(item: T) => any} getValue Function to get the groupable field value from an item.
 * @param {string} otherKey Fallback key for items with a null/undefined value or no regex match.
 * @returns {[string, T[]][]} Sorted array of `[groupKey, items]` pairs.
 */
export const buildGroupMap = (items, pattern, getValue, otherKey) => {
  const regex = getRegex(pattern);
  /** @type {Record<string, T[]>} */
  const groups = {};

  items.forEach((item) => {
    const value = getValue(item);

    const key =
      value === null || value === undefined
        ? otherKey
        : regex
          ? (String(value).match(regex)?.[0] ?? otherKey)
          : String(value);

    if (!(key in groups)) groups[key] = [];
    groups[key].push(item);
  });

  return Object.entries(groups).sort(([a], [b]) => compare(a, b));
};

/**
 * Check whether a value matches a filter condition.
 * @param {any} value The value to test.
 * @param {any} pattern Expected value.
 * @param {RegExp | null | undefined} regex Compiled regex derived from the pattern, if any.
 * @returns {boolean} Whether the value matches the condition.
 */
export const matchesFilter = (value, pattern, regex) => {
  if (regex) {
    return regex.test(String(value ?? ''));
  }

  return value === pattern;
};

/**
 * Sort an array of items using a key function and apply ascending/descending order.
 * @template T
 * @param {T[]} items Items to sort in place.
 * @param {(item: T) => string | number} getKey Returns the pre-computed sort key for an item.
 * @param {boolean} isStringType Whether keys should be compared as strings (locale-aware); if
 * `false`, numeric subtraction is used instead.
 * @param {string | undefined} [order] Sort order; reverses the array when `'descending'`.
 * @returns {T[]} The sorted array (same reference).
 */
export const sortItemsByKey = (items, getKey, isStringType, order) => {
  items.sort((a, b) => {
    const aKey = getKey(a);
    const bKey = getKey(b);

    return isStringType
      ? compare(/** @type {string} */ (aKey), /** @type {string} */ (bKey))
      : /** @type {number} */ (aKey) - /** @type {number} */ (bKey);
  });

  if (order === 'descending') {
    items.reverse();
  }

  return items;
};
