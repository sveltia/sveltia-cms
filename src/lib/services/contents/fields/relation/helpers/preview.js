/**
 * @import { RelationOption } from '$lib/types/private';
 * @import { RelationField } from '$lib/types/public';
 */

/**
 * Value field templates that resolve to the referenced entry’s slug. A slug is not shown next to
 * the label, because the label is enough to identify the entry.
 */
const SLUG_VALUE_FIELDS = ['slug', '{{slug}}', '{{fields.slug}}'];

/**
 * Get the labels to be shown in the preview of a Relation field. A stored value that is found in
 * the options is shown by its label, followed by the value itself in parentheses unless the value
 * is the referenced entry’s slug; a value that is not found, e.g. a reference to a deleted entry,
 * is shown as is.
 * @param {object} args Arguments.
 * @param {RelationField} args.fieldConfig Field configuration.
 * @param {string | string[] | undefined} args.currentValue Stored value(s).
 * @param {RelationOption[]} args.options Field options.
 * @returns {string[]} Labels, in the stored order. Empty if there is no value.
 */
export const getPreviewLabels = ({ fieldConfig, currentValue, options }) => {
  const { multiple = false, value_field: valueField = '{{slug}}' } = fieldConfig;
  const values = multiple ? (currentValue ?? []) : [currentValue];

  return /** @type {string[]} */ (values)
    .filter((value) => value !== undefined)
    .map((value) => {
      const label = options.find((option) => option.value === value)?.label;

      if (!label || label === value) {
        return value;
      }

      return SLUG_VALUE_FIELDS.includes(valueField) ? label : `${label} (${value})`;
    });
};
