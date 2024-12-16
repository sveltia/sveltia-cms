import { getFieldDisplayValue } from '$lib/services/contents/entry/fields';

/**
 * Format the summary template of an Object field.
 * @param {object} args - Arguments.
 * @param {string} args.collectionName - Collection name.
 * @param {string} [args.fileName] - File name.
 * @param {FieldKeyPath} args.keyPath - Field key path.
 * @param {FlattenedEntryContent} args.valueMap - Entry content.
 * @param {LocaleCode} args.locale - Locale code.
 * @param {string} [args.summaryTemplate] - Summary template, e.g. `{{fields.slug}}`.
 * @returns {string} Formatted summary.
 */
export const formatSummary = ({
  collectionName,
  fileName,
  keyPath,
  valueMap,
  locale,
  summaryTemplate,
}) => {
  if (!summaryTemplate) {
    return (
      valueMap[`${keyPath}.title`] ||
      valueMap[`${keyPath}.name`] ||
      // Use the first string-type field value, if available
      Object.entries(valueMap).find(
        ([key, value]) => key.startsWith(`${keyPath}.`) && typeof value === 'string' && !!value,
      )?.[1] ||
      ''
    );
  }

  return summaryTemplate.replaceAll(/{{(.+?)}}/g, (_match, /** @type {string} */ placeholder) => {
    const [tag, ...transformations] = placeholder.split(/\s*\|\s*/);

    return getFieldDisplayValue({
      collectionName,
      fileName,
      valueMap,
      keyPath: `${keyPath}.${tag.replace(/^fields\./, '')}`,
      locale,
      transformations,
    });
  });
};
