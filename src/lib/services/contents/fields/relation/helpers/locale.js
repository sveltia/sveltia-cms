/**
 * @import { InternalLocaleCode } from '$lib/types/private';
 * @import { Field, RelationField } from '$lib/types/public';
 */

/**
 * Localize a field value copied from another locale. This supports a special case for the Relation
 * field: if the `value_field` option is something like `{{locale}}/{{slug}}`, the stored value is
 * prefixed with a locale code, which has to be replaced with the target locale. Any other value is
 * returned as is.
 * @param {object} args Arguments.
 * @param {Field} args.fieldConfig Field configuration.
 * @param {any} args.value Value copied from the source locale.
 * @param {InternalLocaleCode} args.sourceLocale Source locale.
 * @param {InternalLocaleCode} args.targetLocale Target locale.
 * @returns {any} Localized value.
 */
export const getLocalizedRelationValue = ({ fieldConfig, value, sourceLocale, targetLocale }) => {
  if (fieldConfig.widget !== 'relation' || typeof value !== 'string') {
    return value;
  }

  const { value_field: valueField = '{{slug}}' } = /** @type {RelationField} */ (fieldConfig);

  if (!valueField.startsWith('{{locale}}/') || !value.startsWith(`${sourceLocale}/`)) {
    return value;
  }

  return `${targetLocale}/${value.slice(sourceLocale.length + 1)}`;
};
