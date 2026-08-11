import { isObject } from '@sveltia/utils/object';

/**
 * @import { FilteringConditions, GroupingConditions, SortOrder } from '$lib/types/private';
 * @import { SortableFields } from '$lib/types/public';
 */

/**
 * Parse a view configuration that supports both an array (Netlify/Decap CMS compatible) and an
 * object (Static CMS compatible) format.
 * @template {{ name: string, field: string, pattern: string | RegExp }} T
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
        default: defaultItem
          ? { field: defaultItem.field, pattern: defaultItem.pattern }
          : undefined,
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
