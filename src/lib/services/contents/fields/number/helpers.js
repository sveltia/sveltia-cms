/**
 * @import { NumberField } from '$lib/types/public';
 */

/**
 * Whether the field stores its value as a floating-point number rather than an integer.
 * @param {NumberField} fieldConfig Field configuration.
 * @returns {boolean} `true` if the `value_type` is `float` or `float/string`.
 */
const isFloatType = ({ value_type: valueType = 'int' }) =>
  ['float', 'float/string'].includes(valueType);

/**
 * Whether the field stores its value as a string rather than a number. That’s the case for the
 * `int/string` and `float/string` types, as well as any custom `value_type`.
 * @param {NumberField} fieldConfig Field configuration.
 * @returns {boolean} `true` if the stored value is a string.
 */
const isStringOutput = ({ value_type: valueType = 'int' }) => !['int', 'float'].includes(valueType);

/**
 * Get the value to be shown in the editor’s number input for the given stored value.
 * @param {object} args Arguments.
 * @param {string | number | null | undefined} args.currentValue Value in the entry draft.
 * @param {NumberField} args.fieldConfig Field configuration.
 * @returns {number | undefined} Number to be shown. `NaN` if the stored value is an empty string,
 * so the input is emptied; `undefined` if there is no stored value, or it can’t be parsed.
 */
export const getNumberInputValue = ({ currentValue, fieldConfig }) => {
  if (typeof currentValue === 'number') {
    return currentValue;
  }

  if (typeof currentValue !== 'string') {
    return undefined;
  }

  if (!currentValue.trim()) {
    return NaN;
  }

  const value = isFloatType(fieldConfig)
    ? Number.parseFloat(currentValue)
    : Number.parseInt(currentValue, 10);

  return Number.isNaN(value) ? undefined : value;
};

/**
 * Get the value to be stored in the entry draft for the given number input value, cast according
 * to the field’s `value_type`.
 * @param {object} args Arguments.
 * @param {number | undefined} args.inputValue Value of the number input. `undefined` if the input
 * is empty.
 * @param {NumberField} args.fieldConfig Field configuration.
 * @returns {string | number | null} Value to be stored. An empty input is stored as `null` for the
 * number types, or an empty string for the string types.
 */
export const getNumberFieldValue = ({ inputValue, fieldConfig }) => {
  let value = NaN;

  if (inputValue !== undefined) {
    value = isFloatType(fieldConfig)
      ? Number.parseFloat(String(inputValue))
      : Number.parseInt(String(inputValue), 10);
  }

  if (isStringOutput(fieldConfig)) {
    return Number.isNaN(value) ? '' : String(value);
  }

  return Number.isNaN(value) ? null : value;
};
