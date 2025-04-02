import { generateUUID } from '@sveltia/utils/crypto';

/**
 * @import { InternalLocaleCode } from '$lib/types/private';
 * @import { FieldKeyPath, HiddenField } from '$lib/types/public';
 */

/**
 * Get the default value for a Hidden field.
 * @param {HiddenField} fieldConfig Field configuration.
 * @param {InternalLocaleCode} locale Locale code.
 * @returns {any} Default value.
 * @todo Write tests for this.
 */
const getDefaultValue = (fieldConfig, locale) => {
  const { default: defaultValue } = fieldConfig;

  if (typeof defaultValue !== 'string') {
    return defaultValue;
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

/**
 * Get the default value map for a Hidden field.
 * @param {object} args Arguments.
 * @param {HiddenField} args.fieldConfig Field configuration.
 * @param {FieldKeyPath} args.keyPath Field key path.
 * @param {InternalLocaleCode} args.locale Locale code.
 * @returns {Record<string, any>} Default value map.
 */
export const getHiddenFieldDefaultValueMap = ({ fieldConfig, keyPath, locale }) => ({
  [keyPath]: getDefaultValue(fieldConfig, locale),
});
