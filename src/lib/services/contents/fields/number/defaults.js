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

  if (['int', 'int/string'].includes(valueType)) {
    const parsedValue = isString ? Number.parseInt(value, 10) : value;

    return Number.isInteger(parsedValue) ? { [keyPath]: parsedValue } : {};
  }

  if (['float', 'float/string'].includes(valueType)) {
    const parsedValue = isString ? Number.parseFloat(value) : value;

    return Number.isFinite(parsedValue) ? { [keyPath]: parsedValue } : {};
  }

  return {};
};
