import { compare } from '@sveltia/utils/string';
import equal from 'fast-deep-equal';
import { derived, get, writable } from 'svelte/store';
import { _, locale as appLocale } from 'svelte-i18n';
import { allEntries } from '$lib/services/contents';
import { selectedCollection } from '$lib/services/contents/collection';
import { getEntriesByCollection, selectedEntries } from '$lib/services/contents/collection/entries';
import { getCollectionFilesByEntry } from '$lib/services/contents/collection/files';
import { getIndexFile } from '$lib/services/contents/collection/index-file';
import { getSortKeyType } from '$lib/services/contents/collection/view/sort-keys';
import { getField, getPropertyValue } from '$lib/services/contents/entry/fields';
import { getEntrySummary } from '$lib/services/contents/entry/summary';
import { getDate } from '$lib/services/contents/widgets/date-time/helper';
import { prefs } from '$lib/services/user/prefs';
import { removeMarkdownSyntax } from '$lib/services/utils/markdown';
import { getRegex } from '$lib/services/utils/misc';

/**
 * @import { Readable, Writable } from 'svelte/store';
 * @import {
 * Entry,
 * EntryListView,
 * FilteringConditions,
 * GroupingConditions,
 * InternalCollection,
 * SortingConditions,
 * } from '$lib/types/private';
 * @import { DateTimeField } from '$lib/types/public';
 */

/**
 * List of fields that may contain Markdown syntax and should be stripped before sorting. This
 * includes `title`, `summary`, and `description`, which are commonly used in entry collections.
 * @type {string[]}
 */
const markdownFieldKeys = ['title', 'summary', 'description'];

/**
 * View settings for the selected entry collection.
 * @type {Writable<EntryListView>}
 */
export const currentView = writable({ type: 'list' });

/**
 * Sort the given entries.
 * @param {Entry[]} entries Entry list.
 * @param {InternalCollection} collection Collection that the entries belong to.
 * @param {SortingConditions} [conditions] Sorting conditions.
 * @returns {Entry[]} Sorted entry list.
 * @see https://decapcms.org/docs/configuration-options/#sortable_fields
 */
const sortEntries = (entries, collection, { key, order } = {}) => {
  const _entries = [...entries];

  const {
    name: collectionName,
    _i18n: { defaultLocale: locale },
  } = collection;

  if (key === undefined) {
    const options = { useTemplate: true, allowMarkdown: true };

    return _entries.sort((a, b) =>
      getEntrySummary(collection, a, options).localeCompare(
        getEntrySummary(collection, b, options),
      ),
    );
  }

  const fieldConfig = getField({ collectionName, keyPath: key });
  const type = getSortKeyType({ key, fieldConfig });

  const valueMap = Object.fromEntries(
    _entries.map((entry) => [entry.slug, getPropertyValue({ entry, locale, collectionName, key })]),
  );

  const dateFieldConfig =
    fieldConfig?.widget === 'datetime' ? /** @type {DateTimeField} */ (fieldConfig) : undefined;

  _entries.sort((a, b) => {
    const aValue = valueMap[a.slug];
    const bValue = valueMap[b.slug];

    if (dateFieldConfig) {
      const aDate = aValue ? getDate(aValue, dateFieldConfig) : undefined;
      const bDate = bValue ? getDate(bValue, dateFieldConfig) : undefined;

      return Number(aDate ?? 0) - Number(bDate ?? 0);
    }

    if (type === String) {
      const aValueStr = aValue ? String(aValue) : '';
      const bValueStr = bValue ? String(bValue) : '';

      // Strip Markdown syntax from the values in case of some text fields
      if (markdownFieldKeys.includes(key)) {
        return compare(removeMarkdownSyntax(aValueStr), removeMarkdownSyntax(bValueStr));
      }

      return compare(aValueStr, bValueStr);
    }

    return Number(aValue ?? 0) - Number(bValue ?? 0);
  });

  if (order === 'descending') {
    _entries.reverse();
  }

  const indexFileName = getIndexFile(collection)?.name;

  // Index file should always be at the top
  if (indexFileName) {
    const index = _entries.findIndex((entry) => entry.slug === indexFileName);

    if (index > -1) {
      _entries.unshift(_entries.splice(index, 1)[0]);
    }
  }

  return _entries;
};

/**
 * Filter the given entries.
 * @param {Entry[]} entries Entry list.
 * @param {InternalCollection} collection Collection that the entries belong to.
 * @param {FilteringConditions[]} filters One or more filtering conditions.
 * @returns {Entry[]} Filtered entry list.
 * @see https://decapcms.org/docs/configuration-options/#view_filters
 */
const filterEntries = (entries, collection, filters) => {
  const {
    name: collectionName,
    view_filters: configuredFilters = [],
    _i18n: { defaultLocale: locale },
  } = collection;

  // Ignore invalid filters
  const validFilters = filters.filter(
    ({ field, pattern }) =>
      field !== undefined &&
      pattern !== undefined &&
      configuredFilters.some((f) => f.field === field && String(f.pattern) === String(pattern)),
  );

  return entries.filter((entry) =>
    validFilters.every(({ field, pattern }) => {
      // Check both the raw value and referenced value
      const args = { entry, locale, collectionName, key: field };
      const rawValue = getPropertyValue({ ...args, resolveRef: false });
      const refValue = getPropertyValue({ ...args });
      const regex = getRegex(pattern);

      if (rawValue === undefined || refValue === undefined) {
        return false;
      }

      if (regex) {
        return regex.test(String(rawValue)) || regex.test(String(refValue));
      }

      return rawValue === pattern || refValue === pattern;
    }),
  );
};

/**
 * Group the given entries.
 * @param {Entry[]} entries Entry list.
 * @param {InternalCollection} collection Collection that the entries belong to.
 * @param {GroupingConditions} [conditions] Grouping conditions.
 * @returns {{ name: string, entries: Entry[] }[]} Grouped entries, where each group object contains
 * a name and an entry list. When ungrouped, there will still be one group object named `*`.
 * @see https://decapcms.org/docs/configuration-options/#view_groups
 */
const groupEntries = (
  entries,
  collection,
  { field, pattern } = { field: '', pattern: undefined },
) => {
  if (!field) {
    return entries.length ? [{ name: '*', entries }] : [];
  }

  const {
    name: collectionName,
    _i18n: { defaultLocale: locale },
  } = collection;

  const sortCondition = get(currentView).sort;
  const regex = getRegex(pattern);
  /** @type {Record<string, Entry[]>} */
  const groups = {};
  const otherKey = get(_)('other');

  entries.forEach((entry) => {
    const value = getPropertyValue({ entry, locale, collectionName, key: field });

    const key =
      value === undefined
        ? otherKey
        : regex
          ? (String(value).match(regex)?.[0] ?? otherKey)
          : String(value);

    if (!(key in groups)) {
      groups[key] = [];
    }

    groups[key].push(entry);
  });

  // Sort groups by key
  const sortedGroups = Object.entries(groups)
    .map(([name, _entries]) => ({ name, entries: _entries }))
    .sort(({ name: aKey }, { name: bKey }) => compare(aKey, bKey));

  // Keep the descending order if already sorted, especially on the date field
  if (sortCondition?.key === field && sortCondition.order === 'descending') {
    sortedGroups.reverse();
  }

  return sortedGroups;
};

/**
 * List of all the entries for the selected entry collection.
 * @type {Readable<Entry[]>}
 */
export const listedEntries = derived(
  [allEntries, selectedCollection],
  ([_allEntries, _collection], set) => {
    if (_allEntries && _collection) {
      set(getEntriesByCollection(_collection.name));
    } else {
      set([]);
    }
  },
);

/**
 * Sorted, filtered and grouped entries for the selected entry collection.
 * @type {Readable<{ name: string, entries: Entry[] }[]>}
 */
export const entryGroups = derived(
  // Include `appLocale` as a dependency because `sortEntries()` and `groupEntries()` may return
  // localized labels
  [listedEntries, currentView, appLocale],
  ([_listedEntries, _currentView], set) => {
    const collection = /** @type {InternalCollection} */ (get(selectedCollection));
    /** @type {Entry[]} */
    let entries = [..._listedEntries];

    // Reset the groups if the current collection is empty or a file/singleton collection
    if (!entries.length || !!getCollectionFilesByEntry(collection, entries[0]).length) {
      set([]);
    } else {
      entries = sortEntries(entries, collection, _currentView.sort);

      if (_currentView.filters) {
        entries = filterEntries(entries, collection, _currentView.filters);
      }

      const groups = groupEntries(entries, collection, _currentView.group);

      if (!equal(get(entryGroups), groups)) {
        set(groups);
      }
    }
  },
);

listedEntries.subscribe((entries) => {
  selectedEntries.set([]);

  if (get(prefs).devModeEnabled) {
    // eslint-disable-next-line no-console
    console.info('listedEntries', entries);
  }
});

selectedCollection.subscribe((collection) => {
  if (collection && get(prefs).devModeEnabled) {
    // eslint-disable-next-line no-console
    console.info('selectedCollection', collection);
  }
});
