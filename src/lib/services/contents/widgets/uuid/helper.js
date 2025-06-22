import { generateRandomId, generateUUID } from '@sveltia/utils/crypto';

/**
 * @import { UuidField } from '$lib/types/public';
 */

/**
 * Get the initial value for a UUID field.
 * @param {UuidField} fieldConfig Field configuration.
 * @returns {string} Initial value, either a UUID or a prefixed random ID.
 */
export const getInitialValue = (fieldConfig) => {
  const { prefix, use_b32_encoding: useEncoding } = fieldConfig;
  const value = useEncoding ? generateRandomId() : generateUUID();

  return prefix ? `${prefix}${value}` : value;
};
