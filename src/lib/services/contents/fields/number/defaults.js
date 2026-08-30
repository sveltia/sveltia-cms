/**
 * @import { FieldKeyPath, NumberField } from '$lib/types/public';
 * @import { GetDefaultValueMapFuncArgs } from '$lib/types/private';
 */

/**
 * Get the default value map for a Number field.
 * @param {GetDefaultValueMapFuncArgs} args Arguments.
 * @returns {Record<FieldKeyPath, number | string | null>} Default value map.
 */
export const getDefaultValueMap = ({ fieldConfig, keyPath, dynamicValue }) => {
  const { default: defaultValue, value_type: valueType = 'int' } = /** @type {NumberField} */ (
    fieldConfig
  );

  const value = dynamicValue ?? defaultValue;
  const isString = typeof value === 'string';

  if (value === undefined) {
    if (valueType === 'int' || valueType === 'float') {
      return { [keyPath]: null };
    }

    return { [keyPath]: '' };
  }

  // The `int/string` and `float/string` types accept the same input as `int` and `float` but save
  // it as a string, which is what the editor writes once the value is changed
  if (['int', 'int/string'].includes(valueType)) {
    const parsedValue = isString ? Number.parseInt(value, 10) : value;

    if (!Number.isInteger(parsedValue)) {
      return {};
    }

    return { [keyPath]: valueType === 'int' ? parsedValue : String(parsedValue) };
  }

  if (['float', 'float/string'].includes(valueType)) {
    const parsedValue = isString ? Number.parseFloat(value) : value;

    if (!Number.isFinite(parsedValue)) {
      return {};
    }

    return { [keyPath]: valueType === 'float' ? parsedValue : String(parsedValue) };
  }

  return {};
};
