import { generateRandomId, generateUUID } from '@sveltia/utils/crypto';

/**
 * @import { UuidField } from '$lib/types/public';
 */

/**
 * Get the default value for a UUID field.
 * @param {UuidField} fieldConfig Field configuration.
 * @returns {string} Default value.
 */
export const getDefaultValue = (fieldConfig) => {
  const { prefix, use_b32_encoding: useEncoding } = fieldConfig;
  const value = useEncoding ? generateRandomId() : generateUUID();

  return prefix ? `${prefix}${value}` : value;
};
