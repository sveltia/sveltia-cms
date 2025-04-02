/**
 * @import { FieldKeyPath, BooleanField } from '$lib/types/public';
 */

/**
 * Get the default value map for a Boolean field.
 * @param {object} args Arguments.
 * @param {BooleanField} args.fieldConfig Field configuration.
 * @param {FieldKeyPath} args.keyPath Field key path.
 * @returns {Record<string, boolean>} Default value map.
 */
export const getBooleanFieldDefaultValueMap = ({ fieldConfig, keyPath }) => {
  const { default: defaultValue } = fieldConfig;

  return { [keyPath]: typeof defaultValue === 'boolean' ? defaultValue : false };
};
