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
