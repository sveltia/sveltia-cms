import { unique } from '@sveltia/utils/array';
import { isObject } from '@sveltia/utils/object';
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
import { prefs } from '$lib/services/user/prefs';
import { getRegex } from '$lib/services/utils/misc';

/**
 * @import { Readable, Writable } from 'svelte/store';
 * @import {
 * BackendService,
 * Entry,
 * EntryCollection,
 * EntryListView,
 * FilteringConditions,
 * GroupingConditions,
 * InternalCollection,
 * SortingConditions,
 * SortOrder,
 * } from '$lib/types/private';
 * @import { DateTimeField, FieldKeyPath, NumberField, SortableFields } from '$lib/types/public';
 */

/**
 * @see https://decapcms.org/docs/configuration-options/#sortable_fields
 */
const defaultSortableFields = ['title', 'name', 'date', 'author', 'description'];

/**
 * View settings for the selected entry collection.
 * @type {Writable<EntryListView>}
 */
export const currentView = writable({ type: 'list' });

/**
 * Remove some Markdown syntax characters from the given string for proper sorting. This includes
 * bold, italic and code that might appear in the entry title.
 * @param {string} str Original string.
 * @returns {string} Modified string.
 */
const removeMarkdownChars = (str) => str.replace(/[_*`]+/g, '');

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
    index_file: indexFile,
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

  const fieldConfig = getFieldConfig({ collectionName, keyPath: key });

  const type =
    { slug: String, commit_author: String, commit_date: Date }[key] ??
    (() => {
      if (fieldConfig?.widget === 'boolean') {
        return Boolean;
      }

      if (fieldConfig?.widget === 'number') {
        const { value_type: valueType = 'int' } = /** @type {NumberField} */ (fieldConfig);

        if (valueType === 'int' || valueType === 'float') {
          return Number;
        }
      }

      return String;
    })();

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
      return compare(
        removeMarkdownChars(aValue ? String(aValue) : ''),
        removeMarkdownChars(bValue ? String(bValue) : ''),
      );
    }

    return Number(aValue ?? 0) - Number(bValue ?? 0);
  });

  if (order === 'descending') {
    _entries.reverse();
  }

  // Index file should always be at the top
  if (typeof indexFile?.name === 'string') {
    const index = _entries.findIndex((entry) => entry.slug === indexFile.name);

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
 * View settings for all the folder collections.
 * @type {Writable<Record<string, EntryListView> | undefined>}
 */
const entryListSettings = writable();

/**
 * Get sortable fields for the given collection.
 * @param {EntryCollection} collection Collection.
 * @returns {{ fields: string[], default: SortingConditions }} A list of sortable fields and default
 * sort conditions.
 */
export const getSortableFields = (collection) => {
  const {
    name: collectionName,
    identifier_field: customIdField,
    sortable_fields: customSortableFields,
  } = collection;

  /** @type {string[]} */
  let fields = [];
  /** @type {string | undefined} */
  let defaultKey;
  /** @type {SortOrder | undefined} */
  let defaultOrder;

  if (customSortableFields) {
    if (Array.isArray(customSortableFields)) {
      fields = customSortableFields;
    }

    if (isObject(customSortableFields)) {
      const def = /** @type {SortableFields} */ (customSortableFields);

      if (Array.isArray(def.fields)) {
        fields = def.fields;
      }

      if (def.default && isObject(def.default)) {
        defaultKey = def.default.field;
        defaultOrder = ['descending', 'Descending'].includes(def.default.direction ?? '')
          ? 'descending'
          : 'ascending';
      }
    }
  } else {
    fields = [...defaultSortableFields];

    if (customIdField) {
      fields.unshift(customIdField);
      defaultKey = customIdField;
    }
  }

  // Make sure the fields exist
  fields = unique(fields).filter((keyPath) => !!getFieldConfig({ collectionName, keyPath }));

  return {
    fields,
    default: {
      key: defaultKey ?? fields[0],
      order: defaultOrder ?? 'ascending',
    },
  };
};

/**
 * Get a field’s label by key.
 * @param {EntryCollection} collection Collection.
 * @param {FieldKeyPath | string} key Field key path or one of other entry metadata property keys:
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
 * @type {Readable<{ key: string, label: string }[]>}
 */
export const sortFields = derived(
  // Include `appLocale` as a dependency because `getSortFieldLabel()` may return a localized label
  [selectedCollection, allEntries, appLocale],
  ([collection, _allEntries], set) => {
    // Disable sorting for file collections
    if (!collection?.folder) {
      set([]);

      return;
    }

    const _collection = /** @type {EntryCollection} */ (collection);
    const { fields, default: defaultSort } = getSortableFields(_collection);
    const view = get(entryListSettings)?.[_collection.name] ?? { type: 'list' };

    view.sort ??= defaultSort;

    if (_allEntries.every((entry) => !!entry.commitAuthor) && !fields.includes('author')) {
      fields.push('commit_author');
    }

    if (_allEntries.every((entry) => !!entry.commitDate) && !fields.includes('date')) {
      fields.push('commit_date');
    }

    set(fields.map((key) => ({ key, label: getSortFieldLabel(_collection, key) })));

    if (!equal(view, get(currentView))) {
      currentView.set(view);
    }
  },
);
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

    // Reset the groups if the current collection is empty or a file collection
    if (!entries.length || !!getFilesByEntry(collection, entries[0]).length) {
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

/**
 * Initialize {@link entryListSettings} and relevant subscribers.
 * @param {BackendService} _backend Backend service.
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

selectedCollection.subscribe((collection) => {
  if (collection && get(prefs).devModeEnabled) {
    // eslint-disable-next-line no-console
    console.info('selectedCollection', collection);
  }
});
