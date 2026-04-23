import { IndexedDB } from '@sveltia/utils/storage';
import { compare } from '@sveltia/utils/string';
import equal from 'fast-deep-equal';

import { getRegex } from '$lib/services/utils/misc';

/**
 * @import { Writable } from 'svelte/store';
 */

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

/**
 * Initialize a view settings store backed by IndexedDB and subscribe to persist changes.
 * @param {{ databaseName?: string } | undefined} repository Repository info.
 * @param {string} storageKey Key used to store/retrieve settings in the database.
 * @param {Writable<Record<string, any> | undefined>} settingsStore Store to initialize and persist.
 */
export const initViewSettingsStorage = async (repository, storageKey, settingsStore) => {
  const { databaseName } = repository ?? {};
  const settingsDB = databaseName ? new IndexedDB(databaseName, 'ui-settings') : null;
  const initial = (await settingsDB?.get(storageKey)) ?? {};

  settingsStore.set(initial);

  // Track the last persisted value in memory so we can skip redundant IndexedDB reads and writes
  // every time the store changes (list views update this store frequently as users sort/filter).
  let lastSaved = initial;

  settingsStore.subscribe((_settings) => {
    if (equal(_settings, lastSaved)) {
      return;
    }

    lastSaved = _settings;

    (async () => {
      try {
        await settingsDB?.set(storageKey, _settings);
      } catch {
        //
      }
    })();
  });
};
