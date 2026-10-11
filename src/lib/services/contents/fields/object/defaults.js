import { isObject } from '@sveltia/utils/object';

import { isFieldRequired } from '$lib/services/contents/entry/fields';
import { populateMissingSubfields } from '$lib/services/contents/fields/list/defaults';
import { flattenKeys } from '$lib/services/utils/object';

/**
 * @import { FlattenedEntryContent, GetDefaultValueMapFuncArgs } from '$lib/types/private';
 * @import {
 * FieldKeyPath,
 * ObjectField,
 * ObjectFieldWithSubFields,
 * ObjectFieldWithTypes,
 * } from '$lib/types/public';
 */

/**
 * Get the default value map for an Object field.
 * @param {GetDefaultValueMapFuncArgs} args Arguments. Note that `dynamicValue` is not used here, as
 * Object fields do not support dynamic values.
 * @returns {Record<FieldKeyPath, any>} Default value map.
 */
export const getDefaultValueMap = (args) => {
  const { fieldConfig, keyPath, locale, defaultLocale, populateDefault } = args;
  const { default: defaultValue } = /** @type {ObjectField} */ (fieldConfig);
  const { fields: subFields } = /** @type {ObjectFieldWithSubFields} */ (fieldConfig);
  const { types, typeKey = 'type' } = /** @type {ObjectFieldWithTypes} */ (fieldConfig);
  const required = isFieldRequired({ fieldConfig, locale });
  /** @type {FlattenedEntryContent} */
  const content = {};

  // If the default value is a valid object, flatten it and prefix keys
  if (isObject(defaultValue)) {
    // Flatten the object and prefix keys with the key path and index
    Object.entries(flattenKeys(defaultValue)).forEach(([key, val]) => {
      content[`${keyPath}.${key}`] = val;
    });

    // The default may leave out some subfields, which then get their own default values, as they
    // do in a List item. With variable types, only the subfields of the chosen type count
    const fields = Array.isArray(types)
      ? types.find(({ name }) => name === defaultValue[typeKey])?.fields
      : subFields;

    if (fields) {
      populateMissingSubfields({ content, itemKeyPath: keyPath, fields, funcArgs: args });
    }

    return content;
  }

  if (!required || Array.isArray(types)) {
    // Enable validation - for optional fields or fields with variable types
    content[keyPath] = null;

    return content;
  }

  // For required fields without object-level default values and without types,
  // populate default values from subfields if they exist and have defaults
  if (subFields && subFields.length > 0) {
    subFields.forEach((_subField) => {
      populateDefault?.({
        content,
        keyPath: [keyPath, _subField.name].join('.'),
        fieldConfig: _subField,
        locale,
        defaultLocale,
        dynamicValues: {},
      });
    });
  }

  return content;
};
