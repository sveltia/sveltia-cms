/**
 * @import { Field } from '$lib/types/public';
 */

/**
 * Check if a field is translatable, i.e. Its field-level `i18n` option is `true`, its alias
 * `translate` or `duplicate_if_empty`, so the field can be edited in every locale. The last one
 * also fills in the other locales’ empty values with the default locale’s value.
 * @param {Field['i18n']} i18n Field-level `i18n` option.
 * @returns {boolean} Result.
 */
export const isFieldTranslatable = (i18n) =>
  i18n === true || i18n === 'translate' || i18n === 'duplicate_if_empty';

/**
 * Check if a field holds a value in every locale, i.e. Its field-level `i18n` option is one of the
 * translatable ones (see {@link isFieldTranslatable}) or `duplicate`, where the default locale’s
 * value is copied to other locales.
 * @param {Field['i18n']} i18n Field-level `i18n` option.
 * @returns {boolean} Result.
 */
export const isFieldLocalized = (i18n) => isFieldTranslatable(i18n) || i18n === 'duplicate';

/**
 * Check if i18n is disabled for a field, i.e. Its field-level `i18n` option is `false`, its alias
 * `none` or not defined, so the field only exists in the default locale.
 * @param {Field['i18n']} i18n Field-level `i18n` option.
 * @returns {boolean} Result.
 */
export const isFieldI18nDisabled = (i18n) =>
  i18n === undefined || i18n === false || i18n === 'none';
