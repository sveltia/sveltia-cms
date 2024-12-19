import { escapeRegExp } from '@sveltia/utils/string';
import { getFieldConfig, getFieldDisplayValue } from '$lib/services/contents/entry/fields';

/**
 * Check if the given fields contain a single List widget with the `root` option enabled.
 * @param {Field[]} fields - Field list.
 * @returns {boolean} Result.
 */
export const hasRootListField = (fields) =>
  fields.length === 1 &&
  fields[0].widget === 'list' &&
  /** @type {ListField} */ (fields[0]).root === true;

/**
 * Format the summary template of a List field.
 * @param {object} args - Arguments.
 * @param {string} args.collectionName - Collection name.
 * @param {string} [args.fileName] - File name.
 * @param {FieldKeyPath} args.keyPath - Field key path.
 * @param {FlattenedEntryContent} args.valueMap - Entry content.
 * @param {LocaleCode} args.locale - Locale code.
 * @param {string} [args.summaryTemplate] - Summary template, e.g. `{{fields.slug}}`.
 * @param {boolean} args.hasSingleSubField - Whether the field has a single `field` instead of
 * multiple `fields`.
 * @param {number} args.index - List index.
 * @returns {string} Formatted summary.
 */
export const formatSummary = ({
  collectionName,
  fileName,
  keyPath,
  valueMap,
  locale,
  summaryTemplate,
  hasSingleSubField,
  index,
}) => {
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

    return (
      item.title ||
      item.name ||
      // Use the first string-type field value, if available
      Object.values(item).find((value) => typeof value === 'string' && !!value) ||
      ''
    );
  }

  return summaryTemplate.replaceAll(/{{(.+?)}}/g, (_match, /** @type {string} */ placeholder) => {
    const [tag, ...transformations] = placeholder.split(/\s*\|\s*/);
    const _keyPath = `${keyPath}.${index}.${tag.replace(/^fields\./, '')}`;

    if (hasSingleSubField) {
      // Check if the key path is valid
      if (!getFieldConfig({ collectionName, fileName, valueMap, keyPath: _keyPath })) {
        return '';
      }
    }

    return getFieldDisplayValue({
      collectionName,
      fileName,
      valueMap,
      keyPath: hasSingleSubField ? `${keyPath}.${index}` : _keyPath,
      locale,
      transformations,
    });
  });
};
