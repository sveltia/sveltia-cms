import { generateUUID } from '@sveltia/utils/crypto';

/**
 * Get the default value for a Hidden field.
 * @param {HiddenField} fieldConfig - Field configuration.
 * @param {LocaleCode} locale - Locale code.
 * @returns {string} Default value.
 * @todo Write tests for this.
 */
export const getDefaultValue = (fieldConfig, locale) => {
  const { default: defaultValue } = fieldConfig;

  if (typeof defaultValue !== 'string') {
    return '';
  }

  return defaultValue.replaceAll(/{{(.+?)}}/g, (_match, tag) => {
    if (tag === 'locale') {
      return locale;
    }

    if (tag === 'datetime') {
      return new Date().toJSON().replace(/\d+\.\d+Z$/, '00.000Z');
    }

    if (tag === 'uuid') {
      return generateUUID();
    }

    if (tag === 'uuid_short') {
      return generateUUID('short');
    }

    if (tag === 'uuid_shorter') {
      return generateUUID('shorter');
    }

    return '';
  });
};
