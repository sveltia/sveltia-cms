import { generateRandomId, generateUUID } from '@sveltia/utils/crypto';

/**
 * Get the default value for a UUID field.
 * @param {UuidField} fieldConfig - Field configuration.
 * @returns {string} Default value.
 * @todo Write tests for this.
 */
export const getDefaultValue = (fieldConfig) => {
  const { prefix, use_b32_encoding: useEncoding } = fieldConfig;
  const value = useEncoding ? generateRandomId() : generateUUID();

  return prefix ? `${prefix}${value}` : value;
};
