import { isObject } from '@sveltia/utils/object';

import { getEmptyOptionValue } from '$lib/services/contents/fields/select/helpers';

/**
 * @import { GetDefaultValueMapFuncArgs } from '$lib/types/private';
 * @import { FieldKeyPath, RelationField, SelectField } from '$lib/types/public';
 */

/**
 * Get the default value map for a Relation/Select field.
 * @param {GetDefaultValueMapFuncArgs} args Arguments.
 * @returns {Record<FieldKeyPath, any>} Default value map.
 */
export const getDefaultValueMap = ({ fieldConfig, keyPath, dynamicValue }) => {
  const config = /** @type {RelationField | SelectField} */ (fieldConfig);
  const { default: defaultValue, multiple = false } = config;
  // A Relation field has no `options`, so its value is always a string
  const [firstOption] = /** @type {SelectField} */ (config).options ?? [];

  const value =
    dynamicValue !== undefined ? dynamicValue.split(/,\s*/).map((val) => val.trim()) : defaultValue;

  const isArray = Array.isArray(value) && !!value.length;

  if (!multiple) {
    if (dynamicValue !== undefined) {
      // For single select with dynamicValue, take the first item from split
      const splitValue = dynamicValue.split(/,\s*/).map((val) => val.trim());

      return { [keyPath]: splitValue[0] || '' };
    }

    return {
      [keyPath]:
        value !== undefined
          ? value
          : getEmptyOptionValue(isObject(firstOption) ? firstOption.value : firstOption),
    };
  }

  if (isArray) {
    return Object.fromEntries(value.map((val, index) => [`${keyPath}.${index}`, val]));
  }

  return { [keyPath]: [] };
};
