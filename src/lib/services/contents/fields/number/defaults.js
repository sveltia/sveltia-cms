import {
  getNumberFieldValue,
  isInvalidNumberValue,
} from '$lib/services/contents/fields/number/helpers';

/**
 * @import { FieldKeyPath, NumberField } from '$lib/types/public';
 * @import { GetDefaultValueMapFuncArgs } from '$lib/types/private';
 */

/**
 * Value types of a Number field.
 */
const VALUE_TYPES = ['int', 'float', 'int/string', 'float/string'];

/**
 * Get the default value map for a Number field.
 * @param {GetDefaultValueMapFuncArgs} args Arguments.
 * @returns {Record<FieldKeyPath, number | string | null>} Default value map.
 */
export const getDefaultValueMap = ({ fieldConfig, keyPath, dynamicValue }) => {
  const config = /** @type {NumberField} */ (fieldConfig);
  const { default: defaultValue, value_type: valueType = 'int' } = config;
  const value = dynamicValue ?? defaultValue;

  if (value === undefined) {
    if (valueType === 'int' || valueType === 'float') {
      return { [keyPath]: null };
    }

    return { [keyPath]: '' };
  }

  if (!VALUE_TYPES.includes(valueType)) {
    return {};
  }

  // Parse the whole string, not just its leading digits like `parseInt()` does, which reads `12abc`
  // as `12` and `1e3` as `1`
  const number =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value)
        : Number.NaN;

  if (isInvalidNumberValue(number, config)) {
    return {};
  }

  // The `int/string` and `float/string` types accept the same input as `int` and `float` but save
  // it as a string, which is what the editor writes once the value is changed
  return { [keyPath]: getNumberFieldValue({ inputValue: number, fieldConfig: config }) };
};
