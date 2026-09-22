import { _ } from '@sveltia/i18n';
import { compare } from '@sveltia/utils/string';
import equal from 'fast-deep-equal';

import { getRepositoryDatabase } from '$lib/services/utils/database';
import { getRegex } from '$lib/services/utils/regex';
import { createRootEffect } from '$lib/services/utils/state.svelte';

/**
 * @import { FilteringConditions, GroupingConditions } from '$lib/types/private';
 * @import { ViewFilter, ViewGroup } from '$lib/types/public';
 */

/**
 * Conditions of a view filter or group: the target field, and what its value is matched against.
 * @typedef {FilteringConditions | GroupingConditions} ViewConditions
 */

/**
 * Comparison operators a view filter or group can define in addition to, or instead of, `pattern`.
 * Listed in the order the operators are written to a condition key by {@link getConditionKey}.
 * @type {('eq' | 'ne' | 'lt' | 'lte' | 'gt' | 'gte' | 'in' | 'not_in')[]}
 * @see https://sveltiacms.app/en/docs/collections/entries/views#filtering
 */
export const COMPARISON_OPERATORS = ['eq', 'ne', 'lt', 'lte', 'gt', 'gte', 'in', 'not_in'];

/**
 * Get the conditions a view filter or group option defines, leaving out the `name` and `label`,
 * which identify the option in the menu but not what it matches. This is what the view settings
 * hold for an applied filter or group, so an option is applied by looking up its conditions with
 * {@link getConditionKey}.
 * @param {ViewFilter | ViewGroup} option View filter or group option.
 * @returns {ViewConditions} Conditions, with only the properties the option defines.
 */
export const getViewConditions = (option) => {
  const { field, pattern } = option;
  /** @type {ViewConditions} */
  const conditions = { field };

  if (pattern !== undefined) {
    conditions.pattern = pattern;
  }

  COMPARISON_OPERATORS.forEach((operator) => {
    if (option[operator] !== undefined) {
      conditions[operator] = /** @type {any} */ (option[operator]);
    }
  });

  return conditions;
};

/**
 * Check whether the conditions include a comparison operator, as opposed to a plain `pattern`, or
 * nothing but the field in the case of a group.
 * @param {ViewConditions | null | undefined} conditions Conditions.
 * @returns {boolean} Whether at least one of the {@link COMPARISON_OPERATORS} is defined.
 */
export const hasComparison = (conditions) =>
  !!conditions && COMPARISON_OPERATORS.some((operator) => conditions[operator] !== undefined);

/**
 * Get a key identifying the conditions of a view filter or group, so that an applied condition can
 * be matched with the option it came from, and the collapsed groups of a view can be saved per
 * condition. Two conditions get the same key when they match the same entries.
 * @param {ViewConditions} conditions Conditions.
 * @returns {string} JSON array of the field, the pattern if any, and the comparison operators if
 * any, e.g. `["date","\\d{4}"]` or `["date",null,{"gte":"{{today}}"}]`. A pattern is a regular
 * expression that can hold any character, so joining the parts with a separator could be
 * ambiguous. A pattern given as a `RegExp` object is written as its string form, which is how the
 * view settings saved before the object was supported hold it, and the operators are written in
 * the order of {@link COMPARISON_OPERATORS} rather than the order they were configured in.
 */
export const getConditionKey = (conditions) => {
  const { field, pattern } = conditions;
  /** @type {any[]} */
  const parts = [field];

  const operators = Object.fromEntries(
    COMPARISON_OPERATORS.filter((operator) => conditions[operator] !== undefined).map(
      (operator) => [operator, conditions[operator]],
    ),
  );

  if (pattern !== undefined) {
    parts.push(String(pattern));
  } else if (Object.keys(operators).length) {
    parts.push(null);
  }

  if (Object.keys(operators).length) {
    parts.push(operators);
  }

  return JSON.stringify(parts);
};

/**
 * View settings with the properties that the group expanders read and write. Any other property,
 * such as the view type, is carried over untouched.
 * @typedef {{
 * group?: GroupingConditions | null,
 * collapsedGroups?: Record<string, string[]>,
 * } & Record<string, unknown>} ViewWithGroups
 */

/**
 * Name of the group holding the items that have no value for the grouping field, or no match for
 * its pattern. A stable token rather than the localized “Other” label, so that anything keyed by
 * the group name — the collapsed state saved in the view — survives a change of the UI locale.
 * Display it with {@link getGroupLabel}.
 */
export const OTHER_GROUP_NAME = '*other';

/**
 * Get the label of a group as it’s shown in the list.
 * @param {string} name Group name.
 * @returns {string} The localized “Other” label for {@link OTHER_GROUP_NAME}, otherwise the name.
 */
export const getGroupLabel = (name) => (name === OTHER_GROUP_NAME ? _('other') : name);

/**
 * Build a sorted group map from a list of items.
 * @template T
 * @param {T[]} items Items to group.
 * @param {string | RegExp | boolean | undefined} pattern Pattern to extract the group key from each
 * value. When provided, the first match is used as the key; unmatched items fall back to
 * {@link OTHER_GROUP_NAME}.
 * @param {(item: T) => any} getValue Function to get the groupable field value from an item.
 * @returns {[string, T[]][]} Array of `[groupKey, items]` pairs, sorted by the group labels.
 */
export const buildGroupMap = (items, pattern, getValue) => {
  const regex = getRegex(pattern);
  /** @type {Record<string, T[]>} */
  const groups = {};

  items.forEach((item) => {
    const value = getValue(item);

    const key =
      value === null || value === undefined
        ? OTHER_GROUP_NAME
        : regex
          ? (String(value).match(regex)?.[0] ?? OTHER_GROUP_NAME)
          : String(value);

    if (!(key in groups)) groups[key] = [];
    groups[key].push(item);
  });

  return Object.entries(groups).sort(([a], [b]) => compare(getGroupLabel(a), getGroupLabel(b)));
};

/**
 * Group the given items by a view group’s conditions.
 * @template T
 * @param {T[]} items Items to group.
 * @param {GroupingConditions | null | undefined} conditions Grouping conditions.
 * @param {(item: T, field: string) => any} getValue Function to get the groupable field value from
 * an item.
 * @returns {Record<string, T[]>} Grouped items, where the key is a group name, displayed with
 * {@link getGroupLabel}, and the value is an item list. Without a field to group by, all the items
 * are in a single group named `*`.
 */
export const groupItems = (items, conditions, getValue) => {
  const { field, pattern } = conditions ?? {};

  if (!field) {
    return items.length ? { '*': items } : {};
  }

  return Object.fromEntries(buildGroupMap(items, pattern, (item) => getValue(item, field)));
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
 * Get the names of the groups that can be collapsed. The `*` group, which holds every item when
 * the list isn’t grouped, has no caption and so no expander.
 * @param {string[]} names Names of all the groups in the list.
 * @returns {string[]} Names of the captioned groups.
 */
export const getCollapsibleGroupNames = (names) => names.filter((name) => name !== '*');

/**
 * Get the key under which the collapsed groups of a view are saved. Each grouping condition
 * produces its own set of groups, so the collapsed state is kept per condition.
 * @param {GroupingConditions | null | undefined} conditions Grouping conditions.
 * @returns {string | undefined} Condition key from {@link getConditionKey}, or `undefined` when
 * the list isn’t grouped.
 */
export const getGroupingKey = (conditions) =>
  conditions ? getConditionKey(conditions) : undefined;

/**
 * Check whether a group is collapsed in the given view.
 * @param {ViewWithGroups} view View settings.
 * @param {string} name Group name.
 * @returns {boolean} Whether the group’s items are hidden.
 */
export const isGroupCollapsed = (view, name) => {
  const key = getGroupingKey(view.group);

  return key !== undefined && !!view.collapsedGroups?.[key]?.includes(name);
};

/**
 * Get the view settings with the collapsed groups of the current grouping condition replaced.
 * @template {ViewWithGroups} T
 * @param {T} view View settings.
 * @param {string[]} names Names of the collapsed groups. The condition is dropped from the saved
 * state when there is none, and so is the whole `collapsedGroups` property once it’s empty.
 * @returns {T} New view settings.
 */
const setCollapsedGroups = (view, names) => {
  const key = getGroupingKey(view.group);

  // The list isn’t grouped, so there is nothing to collapse
  if (key === undefined) {
    return view;
  }

  const { [key]: _current, ...others } = view.collapsedGroups ?? {};
  const collapsedGroups = names.length ? { ...others, [key]: names } : others;
  const { collapsedGroups: _previous, ...rest } = view;

  return /** @type {T} */ (
    Object.keys(collapsedGroups).length ? { ...rest, collapsedGroups } : rest
  );
};

/**
 * Get the view settings with one group collapsed or expanded.
 * @template {ViewWithGroups} T
 * @param {T} view View settings.
 * @param {string} name Group name.
 * @param {boolean} collapsed Whether to hide the group’s items.
 * @returns {T} New view settings.
 */
export const setGroupCollapsed = (view, name, collapsed) => {
  const key = getGroupingKey(view.group);
  const current = key === undefined ? [] : (view.collapsedGroups?.[key] ?? []);
  const names = current.filter((_name) => _name !== name);

  if (collapsed) {
    names.push(name);
  }

  return setCollapsedGroups(view, names);
};

/**
 * Get the view settings with all the given groups collapsed or expanded.
 * @template {ViewWithGroups} T
 * @param {T} view View settings.
 * @param {string[]} names Names of the collapsible groups.
 * @param {boolean} collapsed Whether to hide the groups’ items.
 * @returns {T} New view settings.
 */
export const setAllGroupsCollapsed = (view, names, collapsed) =>
  setCollapsedGroups(view, collapsed ? [...names] : []);

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
