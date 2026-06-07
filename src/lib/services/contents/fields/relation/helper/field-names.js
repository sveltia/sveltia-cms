import { hasTemplateTags } from '$lib/services/common/template';

/**
 * @import { Field, ListField } from '$lib/types/public';
 */

/**
 * Enclose the given field name in brackets if it doesn’t contain any brackets.
 * @internal
 * @param {string} fieldName Field name e.g. `{{name.first}}` or `name.first`.
 * @returns {string} Bracketed field name, e.g. `{{name.first}}`.
 */
export const normalizeFieldName = (fieldName) => {
  if (hasTemplateTags(fieldName)) {
    return fieldName;
  }

  if (fieldName === 'slug') {
    // Avoid confusion with `{{slug}}`, which is the entry slug, not the `slug` field
    return '{{fields.slug}}';
  }

  return `{{${fieldName}}}`;
};

/**
 * Check if the given field configuration is a complex list field with subfields (e.g.
 * `cities.*.name`) and not just a simple list field (e.g. `skills.*`).
 * @internal
 * @param {Field | undefined} fieldConfig Field configuration object.
 * @returns {boolean} Whether the field is a complex list field.
 */
export const isComplexListField = (fieldConfig) => {
  if (!fieldConfig || fieldConfig.widget !== 'list') {
    return false;
  }

  const hasFields = 'fields' in /** @type {ListField} */ (fieldConfig);
  const hasTypes = 'types' in /** @type {ListField} */ (fieldConfig);

  return hasFields || hasTypes;
};
