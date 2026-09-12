import { compare } from '@sveltia/utils/string';
import equal from 'fast-deep-equal';

import { getRepositoryDatabase } from '$lib/services/utils/database';
import { getRegex } from '$lib/services/utils/regex';
import { createRootEffect } from '$lib/services/utils/state.svelte';

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
 * @param {(item: T) => string | number} getKey Returns the sort key for an item. Called once per
 * item.
 * @param {boolean} isStringType Whether keys should be compared as strings (locale-aware); if
 * `false`, numeric subtraction is used instead.
 * @param {string | undefined} [order] Sort order; reverses the array when `'descending'`.
 * @returns {T[]} The sorted array (same reference).
 */
export const sortItemsByKey = (items, getKey, isStringType, order) => {
  const keyedItems = items.map((item) => ({ item, key: getKey(item) }));

  keyedItems.sort(({ key: aKey }, { key: bKey }) =>
    isStringType
      ? compare(/** @type {string} */ (aKey), /** @type {string} */ (bKey))
      : /** @type {number} */ (aKey) - /** @type {number} */ (bKey),
  );

  if (order === 'descending') {
    keyedItems.reverse();
  }

  // Write the order back in place. Spreading the list into `splice()` would pass every item as an
  // argument, which throws a `RangeError` once the list is large enough
  keyedItems.forEach(({ item }, index) => {
    items[index] = item;
  });

  return items;
};

/**
 * Initialize a view settings state backed by IndexedDB and persist any changes to it.
 * @param {{ databaseName?: string } | undefined} repository Repository info.
 * @param {string} storageKey Key used to store/retrieve settings in the database.
 * @param {{ current: Record<string, any> | undefined }} settingsState State to initialize and
 * persist.
 * @param {object} [options] Options.
 * @param {Record<string, any>} [options.defaults] Default settings, overridden by the saved ones.
 * @returns {Promise<() => void>} Function to stop persisting the settings, so that the effect
 * doesn’t pile up when the settings are initialized again.
 */
export const initViewSettingsStorage = async (
  repository,
  storageKey,
  settingsState,
  { defaults = {} } = {},
) => {
  const settingsDB = getRepositoryDatabase(repository, 'ui-settings');
  const initial = { ...defaults, ...(await settingsDB?.get(storageKey)) };

  settingsState.current = initial;

  // Track the last persisted value in memory so we can skip redundant IndexedDB reads and writes
  // every time the state changes (list views update this state frequently as users sort/filter).
  let lastSaved = initial;

  return createRootEffect(() => {
    const { current: _settings } = settingsState;

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
