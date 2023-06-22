import equal from 'fast-deep-equal';
import { flatten } from 'flat';
import moment from 'moment';
import { _ } from 'svelte-i18n';
import { derived, get, writable } from 'svelte/store';
import { user } from '$lib/services/auth';
import {
  allEntries,
  getEntriesByCollection,
  getFieldByKeyPath,
  selectedCollection,
  selectedEntries,
} from '$lib/services/contents';
import { editorLeftPane, editorRightPane } from '$lib/services/contents/editor';
import { prefs } from '$lib/services/prefs';
import LocalStorage from '$lib/services/utils/local-storage';

const storageKey = 'sveltia-cms.contents-view';
/**
 * @see https://decapcms.org/docs/configuration-options/#sortable_fields
 */
const defaultSortableFields = ['title', 'name', 'date', 'author', 'description'];

/**
 * View settings for the selected folder collection.
 * @type {import('svelte/store').Writable<EntryView>}
 */
export const currentView = writable({});

/**
 * Parse the summary template to generate the summary to be displayed on the entry list, etc.
 * @param {Collection} collection Entry’s collection.
 * @param {EntryContent} content Entry content.
 * @returns {string} Formatted summary.
 * @see https://decapcms.org/docs/beta-features/#summary-string-template-transformations
 */
export const parseSummary = (collection, content) => {
  const valueMap = flatten(content);

  return collection.summary.replace(/{{(.+?)}}/g, (_match, tag) => {
    const [fieldName, ...transformations] = tag.split(/\s*\|\s*/);
    const fieldConfig = getFieldByKeyPath(collection.name, undefined, fieldName, valueMap) || {};
    /**
     * @type {string}
     */
    let result = valueMap[fieldName];

    if (!result) {
      return '';
    }

    if (!transformations) {
      return result;
    }

    transformations.forEach((tf) => {
      if (tf === 'upper') {
        result = String(result).toUpperCase();
      }

      if (tf === 'lower') {
        result = String(result).toLowerCase();
      }

      if (tf.startsWith('date')) {
        const [, format] = tf.match(/^date\('(.*?)'\)$/);
        const { picker_utc: pickerUTC = false } = /** @type {DateTimeField} */ (fieldConfig);

        result = (pickerUTC ? moment.utc(result) : moment(result)).format(format);
      }

      if (tf.startsWith('default')) {
        const [, defaultValue] = tf.match(/^default\('?(.*?)'?\)$/);

        result ||= defaultValue;
      }

      if (tf.startsWith('ternary')) {
        const [, truthyValue, falsyValue] = tf.match(/^ternary\('?(.*?)'?,\s*'?(.*?)'?\)$/);

        result = result ? truthyValue : falsyValue;
      }

      if (tf.startsWith('truncate')) {
        const [, number, string = ''] = tf.match(/^truncate\((\d+)(?:,\s*'?(.*?)'?)?\)$/);
        const max = Number(number);
        const truncated = String(result).substring(0, max);

        result = String(result).length > max ? `${truncated}${string}` : truncated;
      }
    });

    return result;
  });
};

/**
 * Sort the given entries.
 * @param {Entry[]} entries Entry list.
 * @param {SortingConditions} [conditions] Sorting conditions.
 * @returns {Entry[]} Sorted entry list.
 * @see https://decapcms.org/docs/configuration-options/#sortable_fields
 */
const sortEntries = (entries, { key, order } = {}) => {
  if (!key || !order) {
    return entries;
  }

  const _entries = [...entries];
  const { defaultLocale = 'default' } = get(selectedCollection)._i18n;

  const type =
    { commit_author: String, commit_date: Date }[key] ||
    _entries[0]?.locales[defaultLocale]?.content[key]?.constructor ||
    String;

  /**
   * Get a property value by key.
   * @param {Entry} entry Entry.
   * @returns {string | Date} Value.
   */
  const getValue = (entry) => {
    const { locales, commitAuthor: { name, email } = {}, commitDate } = entry;

    if (key === 'commit_author') {
      return name || email;
    }

    if (key === 'commit_date') {
      return commitDate;
    }

    return locales[defaultLocale]?.content[key] || entry[key] || '';
  };

  _entries.sort((a, b) => {
    const aValue = getValue(a);
    const bValue = getValue(b);

    return type === String
      ? /** @type {string} */ (aValue).localeCompare(/** @type {string} */ (bValue))
      : Number(/** @type {Date} */ aValue) - Number(/** @type {Date} */ bValue);
  });

  if (order === 'descending') {
    _entries.reverse();
  }

  return _entries;
};

/**
 * Filter the given entries.
 * @param {Entry[]} entries Entry list.
 * @param {FilteringConditions} [conditions] Filtering conditions.
 * @returns {Entry[]} Filtered entry list.
 * @see https://decapcms.org/docs/configuration-options/#view_filters
 */
const filterEntries = (entries, { field, pattern } = { field: undefined, pattern: undefined }) => {
  if (!field) {
    return entries;
  }

  const { defaultLocale = 'default' } = get(selectedCollection)._i18n;
  const regex = typeof pattern === 'string' ? new RegExp(pattern) : undefined;

  return entries.filter((entry) => {
    const value = entry.locales[defaultLocale]?.content[field] || entry[field];

    if (regex) {
      return String(value || '').match(regex);
    }

    return value === pattern;
  });
};

/**
 * Group the given entries.
 * @param {Entry[]} entries Entry list.
 * @param {GroupingConditions} [conditions] Grouping conditions.
 * @returns {{ name: string, entries: Entry[] }[]} Grouped entries, where each group object contains
 * a name and an entry list. When ungrouped, there will still be one group object named `*`.
 * @see https://decapcms.org/docs/configuration-options/#view_groups
 */
const groupEntries = (entries, { field, pattern } = { field: undefined, pattern: undefined }) => {
  if (!field) {
    return entries.length ? [{ name: '*', entries }] : [];
  }

  const sortCondition = get(currentView).sort;
  const { defaultLocale = 'default' } = get(selectedCollection)._i18n;
  const regex = typeof pattern === 'string' ? new RegExp(pattern) : undefined;
  const groups = {};
  const otherKey = get(_)('other');

  entries.forEach((entry) => {
    const value = entry.locales[defaultLocale]?.content[field] || entry[field];
    /**
     * @type {string}
     */
    let key = undefined;

    if (regex) {
      [key = otherKey] = String(value || '').match(regex) || [];
    } else {
      key = value;
    }

    if (!(key in groups)) {
      groups[key] = [];
    }

    groups[key].push(entry);
  });

  // Sort groups by key
  const sortedGroups = Object.entries(groups)
    .map(([name, _entries]) => ({ name, entries: _entries }))
    .sort(({ name: aKey }, { name: bKey }) => aKey.localeCompare(bKey));

  // Keep the descending order if already sorted, especially on the date field
  if (sortCondition?.key === field && sortCondition?.order === 'descending') {
    sortedGroups.reverse();
  }

  return sortedGroups;
};

/**
 * View settings for all the folder collections.
 * @type {import('svelte/store').Writable<{ [key: string]: EntryView }>}
 */
const contentsViewSettings = writable({}, (set) => {
  (async () => {
    try {
      set((await LocalStorage.get(storageKey)) || {});
    } catch {
      //
    }
  })();
});

/**
 * List of sort fields for the selected folder collection.
 * @type {import('svelte/store').Readable<string[]>}
 */
export const sortFields = derived([user, selectedCollection], ([_user, _collection], set) => {
  const { sortable_fields: customSortableFields, fields = [] } = _collection || {};

  const _sortFields = (
    Array.isArray(customSortableFields) ? customSortableFields : defaultSortableFields
  ).filter((fieldName) => fields.find((f) => f.name === fieldName));

  if (_user?.backendName !== 'local') {
    if (!_sortFields.includes('author')) {
      _sortFields.push('commit_author');
    }

    if (!_sortFields.includes('date')) {
      _sortFields.push('commit_date');
    }
  }

  set(_sortFields);
});

/**
 * List of all the entries for the selected folder collection.
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
 * Sorted, filtered and grouped entries for the selected folder collection.
 * @type {import('svelte/store').Readable<{ name: string, entries: Entry[] }[]>}
 */
export const entryGroups = derived(
  [listedEntries, currentView],
  ([_listedEntries, _currentView], set) => {
    /**
     * @type {Entry[]}
     */
    let entries = [..._listedEntries];

    entries = sortEntries(entries, _currentView?.sort);
    entries = filterEntries(entries, _currentView?.filter);

    set(groupEntries(entries, _currentView?.group));
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
    _i18n: { defaultLocale = 'default' },
  } = collection;

  // Reset the editor panes
  editorLeftPane.set({ mode: 'edit', locale: defaultLocale });
  editorRightPane.set({ mode: 'preview', locale: defaultLocale });

  // This only works for folder/entry collections
  if (!fields.length) {
    return;
  }

  /**
   * @type {EntryView}
   */
  const defaultView = {
    type: 'list',
    sort: {
      // Every folder collection should have at least the `title` (or `name`) field, or the
      // `identifier_field` property.
      // @see https://decapcms.org/docs/configuration-options/#identifier_field
      key: customIdField || fields.find((f) => defaultSortableFields.includes(f.name))?.name,
      order: 'ascending',
    },
  };

  const view = get(contentsViewSettings)[collectionName] || defaultView;

  if (!equal(view, get(currentView))) {
    currentView.set(view);
  }
});

currentView.subscribe((view) => {
  const { name } = get(selectedCollection) || {};
  const savedView = get(contentsViewSettings)[name] || {};

  if (!equal(view, savedView)) {
    contentsViewSettings.update((settings) => ({ ...settings, [name]: view }));
  }
});

contentsViewSettings.subscribe((settings) => {
  if (!settings || !Object.keys(settings).length) {
    return;
  }

  (async () => {
    try {
      if (!equal(settings, await LocalStorage.get(storageKey))) {
        await LocalStorage.set(storageKey, settings);
      }
    } catch {
      //
    }
  })();
});
