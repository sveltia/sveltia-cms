import { escapeRegExp } from '@sveltia/utils/string';

import {
  getField,
  getFieldDisplayValue,
  getVisibleFieldDisplayValue,
} from '$lib/services/contents/entry/fields';

/**
 * @import { FlattenedEntryContent, GetFieldArgs, InternalLocaleCode } from '$lib/types/private';
 * @import { FieldKeyPath, ListField } from '$lib/types/public';
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
export const getListFieldInfo = (field) => {
  const hasSingleSubField = 'field' in field;
  const hasMultiSubFields = 'fields' in field;
  const hasVariableTypes = 'types' in field;

  return {
    hasSingleSubField,
    hasMultiSubFields,
    hasVariableTypes,
    hasSubFields: hasSingleSubField || hasMultiSubFields || hasVariableTypes,
  };
};

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

      if (!('field' in listFieldConfig) || listFieldConfig.field.name !== fieldName) {
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
