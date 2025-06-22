import { isObject } from '@sveltia/utils/object';
import { flatten } from 'flat';
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
  const { default: defaultValue, types } = /** @type {ObjectField} */ (fieldConfig);
  const required = isFieldRequired({ fieldConfig, locale });
  /** @type {Record<FieldKeyPath, any>} */
  const content = {};

  if (isObject(defaultValue)) {
    // Flatten the object and prefix keys with the key path and index
    Object.entries(flatten(defaultValue)).forEach(([key, val]) => {
      content[`${keyPath}.${key}`] = val;
    });
  }

  // Hack to enable validation for an empty object
  if ((!required || Array.isArray(types)) && !Object.keys(content).length) {
    content[keyPath] = null;
  }

  return content;
};

/**
 * Format the summary template of an Object field.
 * @param {object} args Arguments.
 * @param {string} args.collectionName Collection name.
 * @param {string} [args.fileName] Collection file name. File collection only.
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
