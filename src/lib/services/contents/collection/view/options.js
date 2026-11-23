import { isObject } from '@sveltia/utils/object';

import { getViewConditions } from '$lib/services/common/view';

/**
 * @import {
 * FilteringConditions,
 * GroupingConditions,
 * ParsedSortableFields,
 * } from '$lib/types/private';
 * @import { SortableField, SortableFields, ViewFilter, ViewGroup } from '$lib/types/public';
 */

/**
 * Parse a view configuration that supports both an array (Netlify/Decap CMS compatible) and an
 * object (Static CMS compatible) format.
 * @template {ViewFilter | ViewGroup} T
 * @param {T[] | Record<string, any> | undefined} config Raw configuration value.
 * @param {string} optionsKey Property name to extract the options array from when config is an
 * object.
 * @returns {{ options: T[], default?: FilteringConditions | GroupingConditions }} Parsed config.
 */
export const parseViewOptions = (config, optionsKey) => {
  if (Array.isArray(config)) {
    return { options: config };
  }

  if (isObject(config)) {
    const options = config[optionsKey];
    const defaultName = config.default;

    if (Array.isArray(options)) {
      const defaultItem = defaultName
        ? options.find(({ name }) => name === defaultName)
        : undefined;

      return {
        options,
        default: defaultItem ? getViewConditions(defaultItem) : undefined,
      };
    }
  }

  return { options: [] };
};

/**
 * Check if the given value is a valid array of strings.
 * @param {unknown} arr Value to check.
 * @returns {arr is string[]} Whether the value is a valid array of strings.
 */
export const isValidArray = (arr) =>
  Array.isArray(arr) && arr.every((item) => typeof item === 'string');

/**
 * Check if the given `sortable_fields` list item is a Decap CMS sortable field object with the
 * `default_sort` option enabled.
 * @param {unknown} item List item.
 * @returns {item is SortableField} Result.
 */
export const hasDefaultSort = (item) => {
  const value = isObject(item) ? /** @type {SortableField} */ (item).default_sort : undefined;

  return value === true || value === 'asc' || value === 'desc';
};

/**
 * Parse a `sortable_fields` list, in which each item is either a field key path or a Decap CMS
 * sortable field object with the `field`, `label` and `default_sort` options. Invalid items are
 * ignored; they are reported by the configuration validator.
 * @param {(string | SortableField)[]} items List items.
 * @returns {ParsedSortableFields} Parsed sortable fields configuration.
 */
const parseSortableFieldList = (items) => {
  /** @type {string[]} */
  const keys = [];
  /** @type {Record<string, string>} */
  const labels = {};
  /** @type {SortableField | undefined} */
  let defaultItem;

  items.forEach((item) => {
    if (typeof item === 'string') {
      keys.push(item);

      return;
    }

    if (!isObject(item) || typeof item.field !== 'string') {
      return;
    }

    const { field, label } = item;

    keys.push(field);

    if (typeof label === 'string' && label.trim()) {
      labels[field] = label;
    }

    // Only one item may have `default_sort`; the validator reports any other, and the first wins
    if (!defaultItem && hasDefaultSort(item)) {
      defaultItem = item;
    }
  });

  return {
    keys,
    ...(Object.keys(labels).length ? { labels } : {}),
    ...(defaultItem
      ? {
          defaultKey: defaultItem.field,
          defaultOrder: defaultItem.default_sort === 'desc' ? 'descending' : 'ascending',
        }
      : {}),
  };
};

/**
 * Parse custom sortable fields configuration.
 * @param {(string | SortableField)[] | SortableFields} customSortableFields Custom sortable fields
 * configuration.
 * @returns {ParsedSortableFields} Parsed sortable fields configuration.
 */
export const parseCustomSortableFields = (customSortableFields) => {
  // Netlify/Decap CMS compatibility: if `sortable_fields` is an array, it should be treated as a
  // list of field keys, or sortable field objects as supported by Decap CMS 3.10
  if (Array.isArray(customSortableFields)) {
    return parseSortableFieldList(customSortableFields);
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
