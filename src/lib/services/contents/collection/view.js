import { IndexedDB } from '@sveltia/utils/storage';
import { compare } from '@sveltia/utils/string';
import equal from 'fast-deep-equal';
import { _, locale as appLocale } from 'svelte-i18n';
import { derived, get, writable } from 'svelte/store';
import { backend } from '$lib/services/backends';
import { allEntries } from '$lib/services/contents';
import { selectedCollection } from '$lib/services/contents/collection';
import { getEntriesByCollection, selectedEntries } from '$lib/services/contents/collection/entries';
import { getFilesByEntry } from '$lib/services/contents/collection/files';
import { getFieldConfig, getPropertyValue } from '$lib/services/contents/entry/fields';
import { getEntrySummary } from '$lib/services/contents/entry/summary';
import { getDate } from '$lib/services/contents/widgets/date-time/helper';
import { prefs } from '$lib/services/prefs';

/**
 * @see https://decapcms.org/docs/configuration-options/#sortable_fields
 */
const defaultSortableFields = ['title', 'name', 'date', 'author', 'description'];

/**
 * View settings for the selected entry collection.
 * @type {import('svelte/store').Writable<EntryListView>}
 */
export const currentView = writable({ type: 'list' });

/**
 * Remove some Markdown syntax characters from the given string for proper sorting. This includes
 * bold, italic and code that might appear in the entry title.
 * @param {string} str - Original string.
 * @returns {string} Modified string.
 */
const removeMarkdownChars = (str) => str.replace(/[_*`]+/g, '');

/**
 * Sort the given entries.
 * @param {Entry[]} entries - Entry list.
 * @param {Collection} collection - Collection that the entries belong to.
 * @param {SortingConditions} [conditions] - Sorting conditions.
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

  const type =
    { slug: String, commit_author: String, commit_date: Date }[key] ||
    (_entries.length
      ? getPropertyValue({ entry: _entries[0], locale, collectionName, key })?.constructor
      : String) ||
    String;

  const valueMap = Object.fromEntries(
    _entries.map((entry) => [entry.slug, getPropertyValue({ entry, locale, collectionName, key })]),
  );

  const fieldConfig = getFieldConfig({ collectionName, keyPath: key });

  const dateFieldConfig =
    fieldConfig?.widget === 'datetime' ? /** @type {DateTimeField} */ (fieldConfig) : undefined;

  _entries.sort((a, b) => {
    const aValue = valueMap[a.slug];
    const bValue = valueMap[b.slug];

    if (aValue === undefined || bValue === undefined) {
      return 0;
    }

    if (dateFieldConfig) {
      const aDate = getDate(aValue, dateFieldConfig);
      const bDate = getDate(bValue, dateFieldConfig);

      if (aDate && bDate) {
        return Number(aDate) - Number(bDate);
      }
    }

    if (type === String) {
      return compare(removeMarkdownChars(aValue), removeMarkdownChars(bValue));
    }

    if (type === Date) {
      return Number(aValue) - Number(bValue);
    }

    return aValue - bValue;
  });

  if (order === 'descending') {
    _entries.reverse();
  }

  return _entries;
};

/**
 * Filter the given entries.
 * @param {Entry[]} entries - Entry list.
 * @param {Collection} collection - Collection that the entries belong to.
 * @param {FilteringConditions[]} filters - One or more filtering conditions.
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
      configuredFilters.some((f) => f.field === field && f.pattern === pattern),
  );

  return entries.filter((entry) =>
    validFilters.every(({ field, pattern }) => {
      // Check both the raw value and referenced value
      const args = { entry, locale, collectionName, key: field };
      const rawValue = getPropertyValue({ ...args, resolveRef: false });
      const refValue = getPropertyValue({ ...args });
      const regex = typeof pattern === 'string' ? new RegExp(pattern) : undefined;

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
 * @param {Entry[]} entries - Entry list.
 * @param {Collection} collection - Collection that the entries belong to.
 * @param {GroupingConditions} [conditions] - Grouping conditions.
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
  const regex = typeof pattern === 'string' ? new RegExp(pattern) : undefined;
  /** @type {Record<string, Entry[]>} */
  const groups = {};
  const otherKey = get(_)('other');

  entries.forEach((entry) => {
    const value = getPropertyValue({ entry, locale, collectionName, key: field });

    if (value === undefined) {
      return;
    }

    const key = regex ? (String(value).match(regex)?.[0] ?? otherKey) : String(value);

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
  if (sortCondition?.key === field && sortCondition?.order === 'descending') {
    sortedGroups.reverse();
  }

  return sortedGroups;
};

/**
 * View settings for all the folder collections.
 * @type {import('svelte/store').Writable<Record<string, EntryListView> | undefined>}
 */
const entryListSettings = writable();

/**
 * Get a field’s label by key.
 * @param {Collection} collection - Collection.
 * @param {FieldKeyPath | string} key - Field key path or one of other entry metadata property keys:
 * `slug`, `commit_author` and `commit_date`.
 * @returns {string} Label. For a nested field, it would be something like `Name – English`.
 */
const getSortFieldLabel = (collection, key) => {
  if (['name', 'commit_author', 'commit_date'].includes(key)) {
    return get(_)(`sort_keys.${key}`);
  }

  if (key.includes('.')) {
    return key
      .split('.')
      .map((_key, index, arr) => {
        if (/^\d+$/.test(_key)) {
          return undefined;
        }

        const keyPath = arr.slice(0, index + 1).join('.');

        return getFieldConfig({ collectionName: collection.name, keyPath })?.label || _key;
      })
      .filter(Boolean)
      .join(' – ');
  }

  return collection.fields?.find(({ name }) => name === key)?.label || key;
};

/**
 * List of sort fields for the selected entry collection.
 * @type {import('svelte/store').Readable<{ key: string, label: string }[]>}
 */
export const sortFields = derived(
  [selectedCollection, allEntries, appLocale],
  ([_collection, _allEntries], set) => {
    const {
      name: collectionName = '',
      files,
      sortable_fields: customSortableFields,
    } = _collection ?? {};

    // Disable sorting for file collections
    if (files) {
      set([]);

      return;
    }

    const _sortFields = (
      Array.isArray(customSortableFields) ? customSortableFields : defaultSortableFields
    ).filter((keyPath) => !!getFieldConfig({ collectionName, keyPath }));

    if (_allEntries.every((entry) => !!entry.commitAuthor) && !_sortFields.includes('author')) {
      _sortFields.push('commit_author');
    }

    if (_allEntries.every((entry) => !!entry.commitDate) && !_sortFields.includes('date')) {
      _sortFields.push('commit_date');
    }

    set(
      _sortFields.map((key) => ({
        key,
        label: _collection ? getSortFieldLabel(_collection, key) : '',
      })),
    );
  },
);
/**
 * List of all the entries for the selected entry collection.
 * @type {import('svelte/store').Readable<Entry[]>}
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
 * @type {import('svelte/store').Readable<{ name: string, entries: Entry[] }[]>}
 */
export const entryGroups = derived(
  [listedEntries, currentView],
  ([_listedEntries, _currentView], set) => {
    const collection = /** @type {Collection} */ (get(selectedCollection));
    /**
     * @type {Entry[]}
     */
    let entries = [..._listedEntries];

    // Reset the groups if the current collection is empty or a file collection
    if (!entries.length || !!getFilesByEntry(collection, entries[0]).length) {
      set([]);
    } else {
      entries = sortEntries(entries, collection, _currentView.sort);

      if (_currentView?.filters) {
        entries = filterEntries(entries, collection, _currentView.filters);
      }

      const groups = groupEntries(entries, collection, _currentView?.group);

      if (!equal(get(entryGroups), groups)) {
        set(groups);
      }
    }
  },
);

/**
 * Initialize {@link entryListSettings} and relevant subscribers.
 * @param {BackendService} _backend - Backend service.
 */
const initSettings = async ({ repository }) => {
  const { databaseName } = repository ?? {};
  const settingsDB = databaseName ? new IndexedDB(databaseName, 'ui-settings') : null;
  const storageKey = 'contents-view';

  entryListSettings.set((await settingsDB?.get(storageKey)) ?? {});

  entryListSettings.subscribe((_settings) => {
    (async () => {
      try {
        if (!equal(_settings, await settingsDB?.get(storageKey))) {
          await settingsDB?.set(storageKey, _settings);
        }
      } catch {
        //
      }
    })();
  });

  selectedCollection.subscribe((collection) => {
    if (!collection) {
      return;
    }

    if (get(prefs).devModeEnabled) {
      // eslint-disable-next-line no-console
      console.info('selectedCollection', collection);
    }

    const {
      name: collectionName,
      identifier_field: customIdField,
      fields = [],
      sortable_fields: customSortableFields = [],
    } = collection;

    // This only works for entry collections
    if (!fields.length) {
      return;
    }

    /**
     * @type {EntryListView}
     */
    const defaultView = {
      type: 'list',
      sort: {
        // Every entry collection should have at least the `title` (or `name`) field, or the
        // `identifier_field` property.
        // @see https://decapcms.org/docs/configuration-options/#identifier_field
        key:
          fields.find((f) => customSortableFields.includes(f.name))?.name ??
          customIdField ??
          fields.find((f) => defaultSortableFields.includes(f.name))?.name,
        order: 'ascending',
      },
    };

    const view = get(entryListSettings)?.[collectionName] ?? defaultView;

    if (!equal(view, get(currentView))) {
      currentView.set(view);
    }
  });

  currentView.subscribe((view) => {
    const { name } = get(selectedCollection) ?? {};
    const savedView = get(entryListSettings)?.[name ?? ''] ?? {};

    if (name && !equal(view, savedView)) {
      entryListSettings.update((_settings) => ({ ..._settings, [name]: view }));
    }
  });
};

backend.subscribe((_backend) => {
  if (_backend && !get(entryListSettings)) {
    initSettings(_backend);
  }
});

listedEntries.subscribe((entries) => {
  selectedEntries.set([]);

  if (get(prefs).devModeEnabled) {
    // eslint-disable-next-line no-console
    console.info('listedEntries', entries);
  }
});
