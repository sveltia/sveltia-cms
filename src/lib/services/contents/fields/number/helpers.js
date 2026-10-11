import { getOrCreate } from '$lib/services/utils/cache';

/**
 * @import { LocaleCode, NumberField } from '$lib/types/public';
 */

/**
 * Cache of {@link Intl.NumberFormat} instances for {@link getNumberFormatter}, keyed by canonical
 * locale.
 * @type {Map<LocaleCode | undefined, Intl.NumberFormat>}
 */
const numberFormatterCache = new Map();

/**
 * Get a formatter to display a Number field value. It keeps every fraction digit the value has:
 * the default of {@link Intl.NumberFormat} rounds the value to 3 digits, showing `35.681236` as
 * `35.681` and `0.0004` as `0`.
 * @param {LocaleCode | undefined} canonicalLocale Canonical locale code.
 * @returns {Intl.NumberFormat} Formatter.
 */
export const getNumberFormatter = (canonicalLocale) =>
  getOrCreate(numberFormatterCache, canonicalLocale, () =>
    Intl.NumberFormat(canonicalLocale, { maximumFractionDigits: 20 }),
  );

/**
 * Whether the field stores its value as a floating-point number rather than an integer.
 * @param {NumberField} fieldConfig Field configuration.
 * @returns {boolean} `true` if the `value_type` is `float` or `float/string`.
 */
export const isFloatType = ({ value_type: valueType = 'int' }) =>
  ['float', 'float/string'].includes(valueType);

/**
 * Whether the field stores its value as a string rather than a number. That’s the case for the
 * `int/string` and `float/string` types, as well as any custom `value_type`.
 * @param {NumberField} fieldConfig Field configuration.
 * @returns {boolean} `true` if the stored value is a string.
 */
const isStringOutput = ({ value_type: valueType = 'int' }) => !['int', 'float'].includes(valueType);

/**
 * Cast the given number according to the field’s `value_type`: an integer type drops the fraction.
 * @param {number} number Number, which can be `NaN`.
 * @param {NumberField} fieldConfig Field configuration.
 * @returns {number} Number to be stored, or `NaN` if the field can’t store it: it isn’t a finite
 * number, or it’s an integer beyond the range JavaScript can represent exactly.
 */
const castNumber = (number, fieldConfig) => {
  // Adding zero turns `-0` into `0`, which is what `-0` or `-0.4` in an integer field means
  if (isFloatType(fieldConfig)) {
    return Number.isFinite(number) ? number + 0 : NaN;
  }

  const integer = Math.trunc(number);

  return Number.isSafeInteger(integer) ? integer + 0 : NaN;
};

/**
 * Whether the given stored value of a Number field is something other than a number the field can
 * store, like the text of an input that couldn’t be parsed, which the editor stores so it can be
 * reported as invalid rather than lost.
 * @param {any} value Value in the entry draft.
 * @param {NumberField} fieldConfig Field configuration.
 * @returns {boolean} `true` if the value is invalid. An empty value is not.
 */
export const isInvalidNumberValue = (value, fieldConfig) => {
  if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) {
    return false;
  }

  return Number.isNaN(castNumber(Number(value), fieldConfig));
};

/**
 * Get the value to be stored in the entry draft for the given number input value, cast according
 * to the field’s `value_type`.
 * @param {object} args Arguments.
 * @param {number | string | undefined} args.inputValue Value of the number input. `undefined` if
 * the input is empty, or a string holding the text in the input if it can’t be parsed as a number.
 * @param {NumberField} args.fieldConfig Field configuration.
 * @returns {string | number | null} Value to be stored. An empty input is stored as `null` for the
 * number types, or an empty string for the string types. Text that isn’t a number, a non-finite
 * number like `Infinity` and an integer beyond the safe range are stored as a string, which the
 * validation reports as invalid, instead of being silently dropped or changed: `Infinity` would be
 * written as `.inf` in YAML or `null` in JSON, and `1e21` would be read as `1` by `parseInt()`.
 */
export const getNumberFieldValue = ({ inputValue, fieldConfig }) => {
  if (typeof inputValue === 'string') {
    return inputValue;
  }

  if (inputValue === undefined || Number.isNaN(inputValue)) {
    return isStringOutput(fieldConfig) ? '' : null;
  }

  const value = castNumber(inputValue, fieldConfig);

  if (Number.isNaN(value)) {
    return String(inputValue);
  }

  return isStringOutput(fieldConfig) ? String(value) : value;
};

/**
 * Get the value to be shown in the editor’s number input for the given stored value.
 * @param {object} args Arguments.
 * @param {string | number | null | undefined} args.currentValue Value in the entry draft.
 * @param {NumberField} args.fieldConfig Field configuration.
 * @param {number | string | undefined} [args.inputValue] Current input value. If the stored value
 * is the invalid value it converts to, the input is kept as is, so the text the user is typing
 * isn’t replaced.
 * @returns {number | string | undefined} Number to be shown. `undefined` if there is no stored
 * value, or it is blank or can’t be parsed, which empties the input.
 */
export const getNumberInputValue = ({ currentValue, fieldConfig, inputValue = undefined }) => {
  if (
    isInvalidNumberValue(currentValue, fieldConfig) &&
    currentValue === getNumberFieldValue({ inputValue, fieldConfig })
  ) {
    return inputValue;
  }

  if (typeof currentValue === 'number') {
    return currentValue;
  }

  if (typeof currentValue !== 'string' || !currentValue.trim()) {
    return undefined;
  }

  // Parse the whole string, not just its leading digits like `parseInt()` does, which reads `1e21`
  // as `1`
  const value = castNumber(Number(currentValue), fieldConfig);

  return Number.isNaN(value) ? undefined : value;
};
