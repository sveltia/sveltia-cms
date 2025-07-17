import { isObject } from '@sveltia/utils/object';
import { isFieldRequired } from '$lib/services/contents/entry/fields';

/**
 * @import { GetDefaultValueMapFuncArgs } from '$lib/types/private';
 * @import { FieldKeyPath, KeyValueField } from '$lib/types/public';
 */

/**
 * Get the default value for a KeyValue field.
 * @param {GetDefaultValueMapFuncArgs} args Arguments.
 * @returns {Record<string, any>} Default value.
 */
const getDefaultValue = ({ fieldConfig, locale }) => {
  const { default: defaultValue } = /** @type {KeyValueField} */ (fieldConfig);
  const required = isFieldRequired({ fieldConfig, locale });

  if (defaultValue && isObject(defaultValue)) {
    return defaultValue;
  }

  if (required) {
    return { '': '' };
  }

  return {};
};

/**
 * Get the default value map for a KeyValue field.
 * @param {GetDefaultValueMapFuncArgs} args Arguments.
 * @returns {Record<FieldKeyPath, string>} Default value map.
 */
export const getDefaultValueMap = (args) => {
  const { keyPath, dynamicValue } = args;
  /** @type {Record<string, any> | undefined} */
  let valueMap;

  if (dynamicValue !== undefined) {
    try {
      const jsonValue = JSON.parse(dynamicValue);

      if (isObject(jsonValue)) {
        // Valid JSON object, use it (even if empty)
        valueMap = /** @type {Record<string, any>} */ (jsonValue);
      }
    } catch {
      // Invalid JSON
    }
  }

  valueMap ??= getDefaultValue(args);

  return Object.fromEntries(
    Object.entries(valueMap)
      .filter(([, val]) => typeof val === 'string')
      .map(([key, val]) => [`${keyPath}.${key}`, val]),
  );
};
