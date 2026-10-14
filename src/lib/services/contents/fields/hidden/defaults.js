import { generateUUID } from '@sveltia/utils/crypto';

import { processNestedTemplates } from '$lib/services/common/template/nested';
import { replaceTemplateTags } from '$lib/services/common/template/tags';
import { applyTransformations, parseTransformations } from '$lib/services/common/transformations';
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

  /**
   * Resolve a template tag of the value.
   * @param {string} placeholder Tag content, e.g. `author-name | upper`.
   * @returns {string} Resolved value.
   */
  const resolvePlaceholder = (placeholder) => {
    const { value: tag, transformations: parsedTransformations } =
      parseTransformations(placeholder);

    const val = replaceTemplateTag(tag, context);
    // Resolve the tags in the transformation arguments, e.g. `default('{{author-login}}')`
    const transformations = processNestedTemplates(parsedTransformations, resolvePlaceholder);

    if (transformations.length) {
      return applyTransformations({ value: val, transformations, locale });
    }

    return val;
  };

  return replaceTemplateTags(value, (_match, placeholder) => resolvePlaceholder(placeholder));
};

/**
 * Get the default value map for a Hidden field.
 * @param {GetDefaultValueMapFuncArgs} args Arguments.
 * @returns {Record<FieldKeyPath, any>} Default value map.
 */
export const getDefaultValueMap = (args) => ({ [args.keyPath]: getDefaultValue(args) });
