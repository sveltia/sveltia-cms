import { isObject } from '@sveltia/utils/object';
import { flatten } from 'flat';
import { populateDefaultValue } from '$lib/services/contents/draft/defaults';
import { isFieldRequired } from '$lib/services/contents/entry/fields';

/**
 * @import { FlattenedEntryContent, GetDefaultValueMapFuncArgs, } from '$lib/types/private';
 * @import { FieldKeyPath, ObjectField } from '$lib/types/public';
 */

/**
 * Get the default value map for an Object field.
 * @param {GetDefaultValueMapFuncArgs} args Arguments. Note that `dynamicValue` is not used here, as
 * Object fields do not support dynamic values.
 * @returns {Record<FieldKeyPath, any>} Default value map.
 */
export const getDefaultValueMap = ({ fieldConfig, keyPath, locale }) => {
  const {
    default: defaultValue,
    fields: subFields,
    types,
  } = /** @type {ObjectField} */ (fieldConfig);

  const required = isFieldRequired({ fieldConfig, locale });
  /** @type {FlattenedEntryContent} */
  const content = {};

  // If the default value is a valid object, flatten it and prefix keys
  if (isObject(defaultValue)) {
    // Flatten the object and prefix keys with the key path and index
    Object.entries(flatten(defaultValue)).forEach(([key, val]) => {
      content[`${keyPath}.${key}`] = val;
    });

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
      populateDefaultValue({
        content,
        keyPath: [keyPath, _subField.name].join('.'),
        fieldConfig: _subField,
        locale,
        dynamicValues: {},
      });
    });
  }

  return content;
};
