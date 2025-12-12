import { generateUUID } from '@sveltia/utils/crypto';
import { get } from 'svelte/store';

import { user } from '$lib/services/user';

/**
 * @import { GetDefaultValueMapFuncArgs, User } from '$lib/types/private';
 * @import { FieldKeyPath, HiddenField } from '$lib/types/public';
 */

/**
 * Get the default value for a Hidden field.
 * @param {GetDefaultValueMapFuncArgs} args Arguments.
 * @returns {any} Default value.
 */
const getDefaultValue = ({ fieldConfig, locale, dynamicValue }) => {
  const { email = '', login = '', name = '' } = /** @type {User} */ (get(user));
  const { default: defaultValue } = /** @type {HiddenField} */ (fieldConfig);
  const value = dynamicValue ?? defaultValue;

  if (typeof value !== 'string') {
    return value;
  }

  return value.replaceAll(/{{(.+?)}}/g, (_match, tag) => {
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

    if (tag === 'author-email') {
      return email;
    }

    if (tag === 'author-login') {
      return login;
    }

    if (tag === 'author-name') {
      return name;
    }

    return '';
  });
};

/**
 * Get the default value map for a Hidden field.
 * @param {GetDefaultValueMapFuncArgs} args Arguments.
 * @returns {Record<FieldKeyPath, any>} Default value map.
 */
export const getDefaultValueMap = (args) => ({ [args.keyPath]: getDefaultValue(args) });
