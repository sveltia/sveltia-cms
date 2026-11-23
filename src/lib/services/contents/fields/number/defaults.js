import {
  getNumberFieldValue,
  getValueType,
  isInvalidNumberValue,
  isStringOutput,
  parseNumber,
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
  const value = dynamicValue ?? config.default;

  if (value === undefined) {
    return { [keyPath]: isStringOutput(config) ? '' : null };
  }

  if (!VALUE_TYPES.includes(getValueType(config))) {
    return {};
  }

  const number = parseNumber(value);

  if (isInvalidNumberValue(number, config)) {
    return {};
  }

  // The `int/string` and `float/string` types accept the same input as `int` and `float` but save
  // it as a string, which is what the editor writes once the value is changed
  return { [keyPath]: getNumberFieldValue({ inputValue: number, fieldConfig: config }) };
};
