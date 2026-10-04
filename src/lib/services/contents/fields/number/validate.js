import { isFieldRequired } from '$lib/services/contents/entry/fields';

/**
 * @import { EntryValidityState, ValidateFieldFuncArgs } from '$lib/types/private';
 * @import { NumberField } from '$lib/types/public';
 */

/**
 * Validate a Number field value against the field configuration.
 * @param {ValidateFieldFuncArgs} args Arguments.
 * @returns {{ validity: EntryValidityState }} Result.
 */
export const validateNumberField = ({ fieldConfig, locale, value }) => {
  const config = /** @type {NumberField} */ (fieldConfig);
  const { value_type: valueType = 'int', min, max } = config;

  // A blank string, which an empty `int/string` or `float/string` field holds, is no value at all,
  // like `null`, rather than zero, which `Number('')` would make it
  const number =
    value === null || (typeof value === 'string' && !value.trim()) ? NaN : Number(value);

  const hasNumber = Number.isFinite(number);
  const rangeUnderflow = hasNumber && typeof min === 'number' && number < min;
  const rangeOverflow = !rangeUnderflow && hasNumber && typeof max === 'number' && number > max;

  const typeMismatch =
    (valueType === 'int' || valueType === 'float') &&
    isFieldRequired({ fieldConfig, locale }) &&
    value === null;

  return {
    validity: { rangeUnderflow, rangeOverflow, typeMismatch },
  };
};
