import { validateDateTimeField } from '$lib/services/contents/fields/date-time/validate';
import { validateNumberField } from '$lib/services/contents/fields/number/validate';
import { validateStringField } from '$lib/services/contents/fields/string/validate';
import { getRegex } from '$lib/services/utils/regex';

/**
 * @import {
 * EntryValidityState,
 * ValidateFieldFuncArgs,
 * } from '$lib/types/private';
 */

/**
 * Map of functions to validate different field types. Each function receives the field config and
 * the current value, and returns an object with the same properties as `EntryValidityState` except
 * `valid`.
 * @type {Record<string, (args: ValidateFieldFuncArgs) => { validity: EntryValidityState }>}
 */
export const VALIDATE_FIELD_FUNCTIONS = {
  datetime: validateDateTimeField,
  number: validateNumberField,
  string: validateStringField,
  text: validateStringField,
};

/**
 * Test a value against the `pattern` option of a field, updating `validity` in place.
 * @param {object} args Arguments.
 * @param {any} args.value Value to test, converted to a string.
 * @param {any} args.validation Pattern validation array or undefined.
 * @param {EntryValidityState} args.validity Validity state to update.
 */
export const validatePattern = ({ value, validation, validity }) => {
  if (Array.isArray(validation)) {
    const regex = getRegex(validation[0]);

    if (regex && !regex.test(String(value))) {
      validity.patternMismatch = true;
    }
  }
};

/**
 * Validate a scalar field (all non-aggregate types), updating `validity` in place.
 * @param {object} args Arguments.
 * @param {any} args.value Current field value.
 * @param {boolean} args.required Whether the field is required.
 * @param {any} args.validation Pattern validation array or undefined.
 * @param {EntryValidityState} args.validity Validity state to update.
 * @param {boolean} [args.selected] Whether the value is a selected option, which is never empty,
 * even if the option’s value is `null` or an empty string.
 * @returns {{ empty: boolean }} Whether the field holds no value at all.
 */
export const validateScalarField = ({
  value,
  required,
  validation,
  validity,
  selected = false,
}) => {
  const trimmed = typeof value === 'string' ? value.trim() : value;
  const empty = !selected && (trimmed === undefined || trimmed === null || trimmed === '');

  if (required && empty) {
    validity.valueMissing = true;
  }

  validatePattern({ value: trimmed, validation, validity });

  return { empty };
};
