/**
 * @import { BooleanField, FieldKeyPath } from '$lib/types/public';
 * @import { GetDefaultValueMapFuncArgs } from '$lib/types/private';
 */

/**
 * Get the default value for a Boolean field.
 * @param {GetDefaultValueMapFuncArgs} args Arguments.
 * @returns {boolean} Default value.
 */
const getDefaultValue = ({ fieldConfig, dynamicValue }) => {
  if (dynamicValue !== undefined) {
    return dynamicValue === 'true';
  }

  const { default: defaultValue } = /** @type {BooleanField} */ (fieldConfig);

  if (typeof defaultValue === 'boolean') {
    return defaultValue;
  }

  return false;
};

/**
 * Get the default value map for a Boolean field.
 * @param {GetDefaultValueMapFuncArgs} args Arguments.
 * @returns {Record<FieldKeyPath, boolean>} Default value map.
 */
export const getDefaultValueMap = (args) => ({ [args.keyPath]: getDefaultValue(args) });
