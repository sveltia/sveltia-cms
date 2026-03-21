import { isObject } from '@sveltia/utils/object';

/**
 * @import { FilteringConditions, GroupingConditions } from '$lib/types/private';
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
