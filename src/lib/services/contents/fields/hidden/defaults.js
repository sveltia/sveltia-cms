import { generateUUID } from '@sveltia/utils/crypto';

import { TEMPLATE_TAG_REPLACE_REGEX } from '$lib/services/common/template/constants';
import {
  applyTransformations,
  TRANSFORMATION_SPLIT_REGEX,
} from '$lib/services/common/transformations';
import { user } from '$lib/services/user/account.svelte';

/**
 * @import { GetDefaultValueMapFuncArgs, User } from '$lib/types/private';
 * @import { FieldKeyPath, HiddenField } from '$lib/types/public';
 */

/**
 * Replace a template tag with its corresponding value based on the provided context.
 * @param {string} tag The template tag to replace.
 * @param {object} context The context for replacement.
 * @param {string} context.locale The current locale.
 * @param {User} context.account The current user account.
 * @returns {string} The replaced value for the template tag.
 */
const replaceTemplateTag = (tag, { locale, account: { email = '', login = '', name = '' } }) => {
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
};

/**
 * Get the default value for a Hidden field.
 * @param {GetDefaultValueMapFuncArgs} args Arguments.
 * @returns {any} Default value.
 */
const getDefaultValue = ({ fieldConfig, locale, dynamicValue }) => {
  const { default: defaultValue } = /** @type {HiddenField} */ (fieldConfig);
  const value = dynamicValue ?? defaultValue;

  if (typeof value !== 'string') {
    return value;
  }

  const context = { locale, account: /** @type {User} */ (user.account) };

  return value.replaceAll(TEMPLATE_TAG_REPLACE_REGEX, (_match, placeholder) => {
    const [tag, ...transformations] = placeholder.trim().split(TRANSFORMATION_SPLIT_REGEX);
    const val = replaceTemplateTag(tag, context);

    if (transformations.length) {
      return applyTransformations({ value: val, transformations, locale });
    }

    return val;
  });
};

/**
 * Get the default value map for a Hidden field.
 * @param {GetDefaultValueMapFuncArgs} args Arguments.
 * @returns {Record<FieldKeyPath, any>} Default value map.
 */
export const getDefaultValueMap = (args) => ({ [args.keyPath]: getDefaultValue(args) });
