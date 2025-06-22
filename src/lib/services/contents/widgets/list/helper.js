import { isObject } from '@sveltia/utils/object';
import { escapeRegExp } from '@sveltia/utils/string';
import { flatten } from 'flat';
import { getField, getFieldDisplayValue } from '$lib/services/contents/entry/fields';

/**
 * @import {
 * FlattenedEntryContent,
 * GetDefaultValueMapFuncArgs,
 * InternalLocaleCode,
 * } from '$lib/types/private';
 * @import { Field, FieldKeyPath, ListField } from '$lib/types/public';
 */

/**
 * Get the default value map for a List field.
 * @param {GetDefaultValueMapFuncArgs} args Arguments.
 * @returns {Record<FieldKeyPath, any>} Default value map.
 */
export const getDefaultValueMap = ({ fieldConfig, keyPath, dynamicValue }) => {
  const { default: defaultValue, fields, types } = /** @type {ListField} */ (fieldConfig);
  /** @type {any[]} */
  let value;

  if (dynamicValue !== undefined) {
    // Filter out empty strings (this handles the case where `dynamicValue` is '')
    value = dynamicValue
      .split(/,\s*/)
      .map((val) => val.trim())
      .filter((val) => val !== '');
  } else {
    value = Array.isArray(defaultValue) ? defaultValue : [];
  }

  const isArray = Array.isArray(value) && !!value.length;

  // Always return the main array, even if empty
  if (!isArray) {
    return { [keyPath]: [] };
  }

  /** @type {Record<string, any>}  */
  const content = { [keyPath]: value };

  if (fields || types) {
    value.forEach((item, index) => {
      if (isObject(item)) {
        // Flatten the object and prefix keys with the key path and index
        Object.entries(flatten(item)).forEach(([key, val]) => {
          content[`${keyPath}.${index}.${key}`] = val;
        });
      } else {
        // For simple string values in object-based lists, add indexed items
        content[`${keyPath}.${index}`] = item;
      }
    });
  } else {
    value.forEach((val, index) => {
      if (!isObject(val)) {
        content[`${keyPath}.${index}`] = val;
      }
    });
  }

  return content;
};

/**
 * Check if the given fields contain a single List widget with the `root` option enabled.
 * @param {Field[]} fields Field list.
 * @returns {boolean} Result.
 */
export const hasRootListField = (fields) =>
  fields.length === 1 &&
  fields[0].widget === 'list' &&
  /** @type {ListField} */ (fields[0]).root === true;

/**
 * Format the summary template of a List field.
 * @param {object} args Arguments.
 * @param {string} args.collectionName Collection name.
 * @param {string} [args.fileName] Collection file name. File collection only.
 * @param {FieldKeyPath} args.keyPath Field key path.
 * @param {FlattenedEntryContent} args.valueMap Entry content.
 * @param {boolean} [args.isIndexFile] Whether the corresponding entry is the collection’s special
 * index file used specifically in Hugo.
 * @param {InternalLocaleCode} args.locale Locale code.
 * @param {string} [args.summaryTemplate] Summary template, e.g. `{{fields.slug}}`.
 * @param {boolean} args.hasSingleSubField Whether the field has a single `field` instead of
 * multiple `fields`.
 * @param {number} args.index List index.
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
  hasSingleSubField,
  index,
}) => {
  const getFieldArgs = { collectionName, fileName, valueMap, isIndexFile };

  if (!summaryTemplate) {
    if (hasSingleSubField) {
      return valueMap[`${keyPath}.${index}`];
    }

    const prefixRegex = new RegExp(`^${escapeRegExp(keyPath)}\\.${index}[\\b\\.]`);

    const item = Object.fromEntries(
      Object.entries(valueMap)
        .filter(([key]) => prefixRegex.test(key))
        .map(([key, value]) => [key.replace(prefixRegex, ''), value]),
    );

    /**
     * Check if a field is visible and has valid content.
     * @param {string} fieldName Field name.
     * @returns {string | null} Field value or `null`.
     */
    const getVisibleFieldValue = (fieldName) => {
      const fieldValue = item[fieldName];

      if (typeof fieldValue !== 'string' || !fieldValue.trim()) {
        return null;
      }

      const fieldPath = `${keyPath}.${index}.${fieldName}`;
      const fieldConfig = getField({ ...getFieldArgs, keyPath: fieldPath });

      return fieldConfig?.widget !== 'hidden' ? fieldValue : null;
    };

    return (
      getVisibleFieldValue('title') ||
      getVisibleFieldValue('name') ||
      // Use the first visible string-type field value, if available
      Object.entries(valueMap).find(([key, value]) => {
        if (!prefixRegex.test(key) || typeof value !== 'string' || !value.trim()) {
          return false;
        }

        const fieldConfig = getField({ ...getFieldArgs, keyPath: key });

        // If we can get field config, check if it's hidden
        // If we can't get field config, assume it's not hidden and allow it
        return fieldConfig ? fieldConfig.widget !== 'hidden' : true;
      })?.[1] ||
      ''
    );
  }

  return summaryTemplate.replaceAll(/{{(.+?)}}/g, (_match, /** @type {string} */ placeholder) => {
    const [tag, ...transformations] = placeholder.split(/\s*\|\s*/);
    const fieldName = tag.replace(/^fields\./, '');
    const _keyPath = `${keyPath}.${index}.${fieldName}`;

    if (hasSingleSubField) {
      // For single-field lists, check if the requested field name matches the actual field name
      const listFieldConfig = /** @type {ListField} */ (getField({ ...getFieldArgs, keyPath }));
      const singleFieldConfig = listFieldConfig?.field;

      if (!singleFieldConfig || singleFieldConfig.name !== fieldName) {
        return '';
      }
    }

    return getFieldDisplayValue({
      ...getFieldArgs,
      keyPath: hasSingleSubField ? `${keyPath}.${index}` : _keyPath,
      locale,
      transformations,
    });
  });
};
