import { isObject } from '@sveltia/utils/object';
import { flatten } from 'flat';

/**
 * @import { GetDefaultValueMapFuncArgs, } from '$lib/types/private';
 * @import { FieldKeyPath, ListField } from '$lib/types/public';
 */

/**
 * Get the default value map for a List field.
 * @param {GetDefaultValueMapFuncArgs} args Arguments.
 * @returns {Record<FieldKeyPath, any>} Default value map.
 */
export const getDefaultValueMap = ({ fieldConfig, keyPath, dynamicValue }) => {
  const { default: defaultValue, fields, types } = /** @type {ListField} */ (fieldConfig);
  /** @type {any[]} */
  let value;

  if (dynamicValue !== undefined) {
    // Filter out empty strings (this handles the case where `dynamicValue` is '')
    value = dynamicValue
      .split(/,\s*/)
      .map((val) => val.trim())
      .filter((val) => val !== '');
  } else {
    value = Array.isArray(defaultValue) ? defaultValue : [];
  }

  const isArray = Array.isArray(value) && !!value.length;

  // Always return the main array, even if empty
  if (!isArray) {
    return { [keyPath]: [] };
  }

  /** @type {Record<string, any>}  */
  const content = { [keyPath]: value };

  if (fields || types) {
    value.forEach((item, index) => {
      if (isObject(item)) {
        // Flatten the object and prefix keys with the key path and index
        Object.entries(flatten(item)).forEach(([key, val]) => {
          content[`${keyPath}.${index}.${key}`] = val;
        });
      } else {
        // For simple string values in object-based lists, add indexed items
        content[`${keyPath}.${index}`] = item;
      }
    });
  } else {
    value.forEach((val, index) => {
      if (!isObject(val)) {
        content[`${keyPath}.${index}`] = val;
      }
    });
  }

  return content;
};
