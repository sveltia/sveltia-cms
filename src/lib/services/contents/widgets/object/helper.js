import { isObject } from '@sveltia/utils/object';
import { flatten } from 'flat';
import { populateDefaultValue } from '$lib/services/contents/draft/defaults';
import {
  getField,
  getFieldDisplayValue,
  isFieldRequired,
} from '$lib/services/contents/entry/fields';

/**
 * @import {
 * FlattenedEntryContent,
 * GetDefaultValueMapFuncArgs,
 * InternalLocaleCode,
 * } from '$lib/types/private';
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

    // Remove empty string values that were added by populateDefaultValue
    // We only want to keep meaningful defaults, not empty strings
    Object.keys(content).forEach((key) => {
      if (content[key] === '') {
        delete content[key];
      }
    });
  }

  return content;
};

/**
 * Format the summary template of an Object field.
 * @param {object} args Arguments.
 * @param {string} args.collectionName Collection name.
 * @param {string} [args.fileName] Collection file name. File/singleton collection only.
 * @param {FieldKeyPath} args.keyPath Field key path.
 * @param {FlattenedEntryContent} args.valueMap Entry content.
 * @param {boolean} [args.isIndexFile] Whether the corresponding entry is the collection’s special
 * index file used specifically in Hugo.
 * @param {InternalLocaleCode} args.locale Locale code.
 * @param {string} [args.summaryTemplate] Summary template, e.g. `{{fields.slug}}`.
 * @returns {string} Formatted summary.
 */
export const formatSummary = ({
  collectionName,
  fileName,
  keyPath,
  valueMap,
  isIndexFile = false,
  locale,
  summaryTemplate,
}) => {
  const getFieldArgs = { collectionName, fileName, valueMap, isIndexFile };

  if (!summaryTemplate) {
    return (
      (typeof valueMap[`${keyPath}.title`] === 'string' && valueMap[`${keyPath}.title`].trim()) ||
      (typeof valueMap[`${keyPath}.name`] === 'string' && valueMap[`${keyPath}.name`].trim()) ||
      // Use the first visible string-type field value, if available
      Object.entries(valueMap).find(
        ([key, value]) =>
          key.startsWith(`${keyPath}.`) &&
          typeof value === 'string' &&
          !!value.trim() &&
          getField({ ...getFieldArgs, keyPath: key })?.widget !== 'hidden',
      )?.[1] ||
      ''
    );
  }

  return summaryTemplate.replaceAll(/{{(.+?)}}/g, (_match, /** @type {string} */ placeholder) => {
    const [tag, ...transformations] = placeholder.split(/\s*\|\s*/);

    return getFieldDisplayValue({
      ...getFieldArgs,
      keyPath: `${keyPath}.${tag.replace(/^fields\./, '')}`,
      locale,
      transformations,
    });
  });
};
