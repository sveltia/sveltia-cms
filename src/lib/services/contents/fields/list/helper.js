import { escapeRegExp } from '@sveltia/utils/string';

import { TEMPLATE_TAG_REPLACE_REGEX } from '$lib/services/common/template/constants';
import { TRANSFORMATION_SPLIT_REGEX } from '$lib/services/common/transformations';
import {
  getField,
  getFieldDisplayValue,
  getVisibleFieldDisplayValue,
} from '$lib/services/contents/entry/fields';
import { getOrCreate } from '$lib/services/utils/cache';

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
 * Cache of pre-compiled regexes keyed by `keyPath:index`.
 * @type {Map<string, RegExp>}
 */
const listSummaryRegexCache = new Map();

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

    const cacheKey = `${keyPath}:${index}`;

    const keyPathRegex = getOrCreate(
      listSummaryRegexCache,
      cacheKey,
      () => new RegExp(`^${escapeRegExp(keyPath)}\\.${index}[\\b\\.]`),
    );

    return getVisibleFieldDisplayValue({
      valueMap,
      locale,
      keyPath: keyPathWithIndex,
      keyPathRegex,
      getFieldArgs,
    });
  }

  /**
   * Replacer function for template tags in the summary template. It extracts the field value based
   * on the placeholder, applies any transformations, and returns the display value to replace the
   * tag.
   * @param {string} _match The entire matched template tag, e.g. `{{fields.slug | upper}}`. Unused
   * in the function but required by the `replace` method.
   * @param {string} placeholder The content inside the template tag, e.g. `fields.slug | upper`.
   * @returns {string} The display value to replace the template tag in the summary.
   */
  const replacer = (_match, placeholder) => {
    const [tag, ...transformations] = placeholder.split(TRANSFORMATION_SPLIT_REGEX);
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
  };

  return summaryTemplate.replaceAll(TEMPLATE_TAG_REPLACE_REGEX, replacer);
};
