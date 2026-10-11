import { isFieldRequired } from '$lib/services/contents/entry/fields';
import { isInvalidNumberValue } from '$lib/services/contents/fields/number/helpers';

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

  // Text the number input couldn’t parse, like `1,5` or `abc`, as well as a number the field can’t
  // store, like `Infinity`, is kept in the draft so it can be reported here, rather than saved as
  // an empty value without a word
  const invalidNumber = isInvalidNumberValue(value, config);
  const hasNumber = !invalidNumber && Number.isFinite(number);
  const rangeUnderflow = hasNumber && typeof min === 'number' && number < min;
  const rangeOverflow = !rangeUnderflow && hasNumber && typeof max === 'number' && number > max;

  const typeMismatch =
    invalidNumber ||
    ((valueType === 'int' || valueType === 'float') &&
      isFieldRequired({ fieldConfig, locale }) &&
      value === null);

  return {
    validity: { rangeUnderflow, rangeOverflow, typeMismatch },
  };
};
