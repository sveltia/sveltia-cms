import { escapeRegExp } from '@sveltia/utils/string';

import {
  getField,
  getFieldDisplayValue,
  getVisibleFieldDisplayValue,
} from '$lib/services/contents/entry/fields';

/**
 * @import { FlattenedEntryContent, GetFieldArgs, InternalLocaleCode } from '$lib/types/private';
 * @import { Field, FieldKeyPath, ListField } from '$lib/types/public';
 */

/**
 * @typedef {object} ListFieldInfo
 * @property {boolean} hasSingleSubField Whether the List field has the `field` (singular) option.
 * @property {boolean} hasMultiSubFields Whether the List field has the `fields` (plural) option.
 * @property {boolean} hasVariableTypes Whether the List field has the variable `types` option.
 * @property {boolean} hasSubFields Whether the List field has sub-fields.
 */

/**
 * Get information about the List field type.
 * @param {ListField} field Field.
 * @returns {ListFieldInfo} Field type information.
 */
export const getListFieldInfo = ({ field, fields, types }) => {
  const hasSingleSubField = !!field;
  const hasMultiSubFields = !!fields;
  const hasVariableTypes = !!types;

  return {
    hasSingleSubField,
    hasMultiSubFields,
    hasVariableTypes,
    hasSubFields: hasSingleSubField || hasMultiSubFields || hasVariableTypes,
  };
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
 * @param {string} [args.fileName] Collection file name. File/singleton collection only.
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
  /** @type {GetFieldArgs} */
  const getFieldArgs = { collectionName, fileName, keyPath: '', valueMap, isIndexFile };
  const keyPathWithIndex = `${keyPath}.${index}`;

  if (!summaryTemplate) {
    if (hasSingleSubField) {
      return valueMap[keyPathWithIndex];
    }

    return getVisibleFieldDisplayValue({
      valueMap,
      locale,
      keyPath: keyPathWithIndex,
      keyPathRegex: new RegExp(`^${escapeRegExp(keyPath)}\\.${index}[\\b\\.]`),
      getFieldArgs,
    });
  }

  return summaryTemplate.replaceAll(/{{(.+?)}}/g, (_match, /** @type {string} */ placeholder) => {
    const [tag, ...transformations] = placeholder.split(/\s*\|\s*/);
    const fieldName = tag.replace(/^fields\./, '');
    const _keyPath = `${keyPathWithIndex}.${fieldName}`;

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
      keyPath: hasSingleSubField ? keyPathWithIndex : _keyPath,
      locale,
      transformations,
    });
  });
};
