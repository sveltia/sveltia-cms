import { unique } from '@sveltia/utils/array';
import { isObject } from '@sveltia/utils/object';
import equal from 'fast-deep-equal';
import { derived, get } from 'svelte/store';
import { _, locale as appLocale } from 'svelte-i18n';

import { allEntries } from '$lib/services/contents';
import { selectedCollection } from '$lib/services/contents/collection';
import { currentView } from '$lib/services/contents/collection/view';
import { entryListSettings } from '$lib/services/contents/collection/view/settings';
import { getField } from '$lib/services/contents/entry/fields';

/**
 * @import { Readable } from 'svelte/store';
 * @import { InternalEntryCollection, SortingConditions, SortOrder } from '$lib/types/private';
 * @import { Field, FieldKeyPath, NumberField, SortableFields } from '$lib/types/public';
 */

/**
 * Default sort keys for the entry collection. In addition to the `title`, `date`, `author` and
 * `description` fields supported by Netlify/Decap CMS, it also includes `name` for the entry name
 * field, which is used by Sveltia CMS to infer the entry title.
 * @see https://decapcms.org/docs/configuration-options/#sortable_fields
 */
export const DEFAULT_SORT_KEYS = ['title', 'name', 'date', 'author', 'description'];

/**
 * Map of special sort keys and their types.
 * @type {Record<string, StringConstructor | DateConstructor>}
 */
export const SPECIAL_SORT_KEY_TYPES = {
  slug: String,
  commit_author: String,
  commit_date: Date,
};

/**
 * List of special sort keys.
 * @type {string[]}
 */
export const SPECIAL_SORT_KEYS = Object.keys(SPECIAL_SORT_KEY_TYPES);

/**
 * Check if the given value is a valid array of strings.
 * @param {unknown} arr Value to check.
 * @returns {arr is string[]} Whether the value is a valid array of strings.
 */
export const isValidArray = (arr) =>
  Array.isArray(arr) && arr.every((item) => typeof item === 'string');

/**
 * Parse custom sortable fields configuration.
 * @param {string[] | SortableFields} customSortableFields Custom sortable fields configuration.
 * @returns {{ keys: string[], defaultKey?: string, defaultOrder?: SortOrder }} Parsed sortable
 * fields configuration.
 */
export const parseCustomSortableFields = (customSortableFields) => {
  // Netlify/Decap CMS compatibility: if `sortable_fields` is an array, it should be treated as a
  // list of field keys
  if (isValidArray(customSortableFields)) {
    return { keys: customSortableFields };
  }

  // Static CMS compatibility: if `sortable_fields` is an object, it should be treated as a
  // definition object with `fields` and `default` properties
  if (isObject(customSortableFields)) {
    const { fields: keys, default: settings } = customSortableFields;

    if (!isValidArray(keys)) {
      return { keys: [] };
    }

    if (!isObject(settings)) {
      return { keys };
    }

    return {
      keys,
      defaultKey: settings.field,
      defaultOrder:
        // Allow title case for Static CMS compatibility
        ['descending', 'Descending'].includes(settings.direction ?? '')
          ? 'descending'
          : 'ascending',
    };
  }

  // Invalid configuration
  return { keys: [] };
};

/**
 * Get default sort keys for the entry collection.
 * @param {FieldKeyPath | undefined} customIdField Custom ID field key path.
 * @returns {{ keys: string[], defaultKey?: string, defaultOrder?: SortOrder }} Parsed sortable
 * fields configuration.
 */
export const getDefaultSortKeys = (customIdField) => {
  if (customIdField) {
    // Filter out the custom ID field from DEFAULT_SORT_KEYS to avoid duplicates
    const filteredDefaultKeys = DEFAULT_SORT_KEYS.filter((key) => key !== customIdField);

    return {
      keys: [customIdField, ...filteredDefaultKeys],
      defaultKey: customIdField,
    };
  }

  return { keys: [...DEFAULT_SORT_KEYS] };
};

/**
 * Get sort configuration for the given collection.
 * @param {object} args Arguments.
 * @param {InternalEntryCollection} args.collection Collection.
 * @param {boolean} args.isCommitAuthorAvailable Whether the entries in the collection have a commit
 * author. Available for some Git-based backends.
 * @param {boolean} args.isCommitDateAvailable Whether the entries in the collection have a commit
 * date. Available for some Git-based backends.
 * @returns {{ keys: string[], default: SortingConditions }} A list of sortable fields and default
 * sort conditions.
 */
export const getSortConfig = ({ collection, isCommitAuthorAvailable, isCommitDateAvailable }) => {
  const {
    name: collectionName,
    identifier_field: customIdField,
    sortable_fields: customSortableFields,
  } = collection;

  let { keys, defaultKey, defaultOrder } = customSortableFields
    ? parseCustomSortableFields(customSortableFields)
    : getDefaultSortKeys(customIdField);

  const hasCommitAuthorKey = keys.includes('commit_author');
  const hasCommitDateKey = keys.includes('commit_date');

  if (isCommitAuthorAvailable) {
    if (!keys.includes('author') && !hasCommitAuthorKey) {
      keys.push('commit_author');
    }
  } else if (hasCommitAuthorKey) {
    keys = keys.filter((key) => key !== 'commit_author');
  }

  if (isCommitDateAvailable) {
    if (!keys.includes('date') && !hasCommitDateKey) {
      keys.push('commit_date');
    }
  } else if (hasCommitDateKey) {
    keys = keys.filter((key) => key !== 'commit_date');
  }

  // Make sure the keys are valid field keys or special keys
  keys = unique(keys).filter(
    (key) =>
      !!key && (SPECIAL_SORT_KEYS.includes(key) || !!getField({ collectionName, keyPath: key })),
  );

  defaultKey = defaultKey && keys.includes(defaultKey) ? defaultKey : keys[0];
  defaultOrder ??= defaultKey ? 'ascending' : undefined;

  return {
    keys,
    default: {
      key: defaultKey,
      order: defaultOrder,
    },
  };
};

/**
 * Get the type of the given key, which can be a field key path or one of the entry metadata keys.
 * @param {object} args Arguments.
 * @param {string} args.key Key.
 * @param {Field | undefined} args.fieldConfig Field configuration object.
 * @returns {StringConstructor | BooleanConstructor | NumberConstructor | DateConstructor} Type of
 * the key.
 */
export const getSortKeyType = ({ key, fieldConfig }) => {
  if (key in SPECIAL_SORT_KEY_TYPES) {
    return SPECIAL_SORT_KEY_TYPES[key];
  }

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
};

/**
 * Get a field’s label by key.
 * @param {object} args Arguments.
 * @param {InternalEntryCollection} args.collection Collection.
 * @param {FieldKeyPath | string} args.key Field key path or one of other entry metadata property
 * keys: `slug`, `commit_author` and `commit_date`.
 * @returns {string} Label. For a nested field, it would be something like `Name – English`.
 */
export const getSortKeyLabel = ({ collection, key }) => {
  if ([...SPECIAL_SORT_KEYS, 'name'].includes(key)) {
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

        // @ts-ignore Hidden field doesn't have `label` property
        return getField({ collectionName: collection.name, keyPath })?.label || _key;
      })
      .filter(Boolean)
      .join(' – ');
  }

  // @ts-ignore Hidden field doesn't have `label` property
  return collection.fields?.find(({ name }) => name === key)?.label || key;
};

/**
 * List of available sort keys for the selected entry collection.
 * @type {Readable<{ key: string, label: string }[]>}
 */
export const sortKeys = derived(
  // Include `appLocale` as a dependency because `getSortKeyLabel()` may return a localized label
  [selectedCollection, allEntries, appLocale],
  ([collection, _allEntries], set) => {
    // Disable sorting for file/singleton collection
    if (!collection || !('folder' in collection)) {
      set([]);

      return;
    }

    const view = get(entryListSettings)?.[collection.name] ?? { type: 'list' };

    const { keys, default: defaultSort } = getSortConfig({
      collection,
      isCommitAuthorAvailable: _allEntries.some((entry) => !!entry.commitAuthor),
      isCommitDateAvailable: _allEntries.some((entry) => !!entry.commitDate),
    });

    view.sort ??= defaultSort;

    set(keys.map((key) => ({ key, label: getSortKeyLabel({ collection, key }) })));

    if (!equal(view, get(currentView))) {
      currentView.set(view);
    }
  },
);
