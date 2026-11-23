import { describe, expect, test } from 'vitest';

import {
  VALIDATE_FIELD_FUNCTIONS,
  validatePattern,
  validateScalarField,
} from '$lib/services/contents/draft/validate/scalar';
import { validateDateTimeField } from '$lib/services/contents/fields/date-time/validate';
import { validateNumberField } from '$lib/services/contents/fields/number/validate';
import { validateStringField } from '$lib/services/contents/fields/string/validate';

/**
 * @import { EntryValidityState } from '$lib/types/private';
 */

/**
 * Create a validity state with every flag cleared.
 * @returns {EntryValidityState} Validity state.
 */
const createValidity = () =>
  /** @type {EntryValidityState} */ ({
    valid: true,
    valueMissing: false,
    tooShort: false,
    tooLong: false,
    rangeUnderflow: false,
    rangeOverflow: false,
    patternMismatch: false,
    typeMismatch: false,
  });

describe('VALIDATE_FIELD_FUNCTIONS', () => {
  test('maps the field types to their validators', () => {
    expect(VALIDATE_FIELD_FUNCTIONS).toEqual({
      datetime: validateDateTimeField,
      number: validateNumberField,
      string: validateStringField,
      text: validateStringField,
    });
  });
});

describe('validatePattern()', () => {
  test('flags a value that doesn’t match the pattern', () => {
    const validity = createValidity();

    validatePattern({ value: 'abc', validation: ['^\\d+$', 'Digits only'], validity });

    expect(validity.patternMismatch).toBe(true);
  });

  test('leaves a matching value unflagged', () => {
    const validity = createValidity();

    validatePattern({ value: '123', validation: ['^\\d+$', 'Digits only'], validity });

    expect(validity.patternMismatch).toBe(false);
  });

  test('never clears a flag set earlier', () => {
    const validity = createValidity();

    validity.patternMismatch = true;

    validatePattern({ value: '123', validation: ['^\\d+$', 'Digits only'], validity });

    expect(validity.patternMismatch).toBe(true);
  });

  test('accepts a regular expression with delimiters and flags, or a RegExp object', () => {
    const validity = createValidity();

    validatePattern({ value: 'ABC', validation: ['/^[a-z]+$/i', 'Letters'], validity });
    validatePattern({ value: 'ABC', validation: [/^[a-z]+$/i, 'Letters'], validity });

    expect(validity.patternMismatch).toBe(false);

    validatePattern({ value: 'ABC', validation: ['/^[a-z]+$/', 'Letters'], validity });

    expect(validity.patternMismatch).toBe(true);
  });

  test('tests a stateful RegExp against every value alike', () => {
    const validation = [/^a/g, 'Starts with a'];
    const validity = createValidity();

    validatePattern({ value: 'abc', validation, validity });
    validatePattern({ value: 'abc', validation, validity });

    expect(validity.patternMismatch).toBe(false);
  });

  test('converts the value to a string', () => {
    const validity = createValidity();

    validatePattern({ value: 42, validation: ['^\\d+$', 'Digits'], validity });
    validatePattern({ value: true, validation: ['^true$', 'True'], validity });

    expect(validity.patternMismatch).toBe(false);

    validatePattern({ value: undefined, validation: ['^\\d+$', 'Digits'], validity });

    expect(validity.patternMismatch).toBe(true);
  });

  test('ignores a missing or invalid pattern', () => {
    const validity = createValidity();

    validatePattern({ value: 'abc', validation: undefined, validity });
    validatePattern({ value: 'abc', validation: '^\\d+$', validity });
    validatePattern({ value: 'abc', validation: ['(', 'Broken'], validity });
    validatePattern({ value: 'abc', validation: [42, 'Not a pattern'], validity });
    validatePattern({ value: 'abc', validation: [], validity });

    expect(validity.patternMismatch).toBe(false);
  });
});

describe('validateScalarField()', () => {
  test('flags a required field without a value as missing', () => {
    [undefined, null, '', '   ', '\n\t'].forEach((value) => {
      const validity = createValidity();

      expect(
        validateScalarField({ value, required: true, validation: undefined, validity }),
      ).toEqual({ empty: true });
      expect(validity.valueMissing).toBe(true);
    });
  });

  test('doesn’t flag an optional field without a value', () => {
    const validity = createValidity();

    expect(
      validateScalarField({ value: '', required: false, validation: undefined, validity }),
    ).toEqual({ empty: true });
    expect(validity.valueMissing).toBe(false);
  });

  test('treats falsy values other than nothing as values', () => {
    [0, false, '0'].forEach((value) => {
      const validity = createValidity();

      expect(
        validateScalarField({ value, required: true, validation: undefined, validity }),
      ).toEqual({ empty: false });
      expect(validity.valueMissing).toBe(false);
    });
  });

  test('never treats a selected option as empty', () => {
    [null, '', undefined].forEach((value) => {
      const validity = createValidity();

      expect(
        validateScalarField({
          value,
          required: true,
          validation: undefined,
          validity,
          selected: true,
        }),
      ).toEqual({ empty: false });
      expect(validity.valueMissing).toBe(false);
    });
  });

  test('tests the trimmed value against the pattern', () => {
    const validity = createValidity();

    validateScalarField({
      value: '  123  ',
      required: false,
      validation: ['^\\d+$', 'Digits only'],
      validity,
    });

    expect(validity.patternMismatch).toBe(false);

    validateScalarField({
      value: ' 12a ',
      required: false,
      validation: ['^\\d+$', 'Digits only'],
      validity,
    });

    expect(validity.patternMismatch).toBe(true);
  });

  test('tests an empty value against the pattern too', () => {
    // The caller relaxes the flags of an empty field afterwards, with `relaxEmptyFieldValidity()`
    const validity = createValidity();

    expect(
      validateScalarField({
        value: '',
        required: false,
        validation: ['^.+$', 'Not empty'],
        validity,
      }),
    ).toEqual({ empty: true });
    expect(validity.patternMismatch).toBe(true);
  });

  test('tests a non-string value as a string', () => {
    const validity = createValidity();

    validateScalarField({ value: 7, required: true, validation: ['^[0-5]$', 'Range'], validity });

    expect(validity.patternMismatch).toBe(true);
    expect(validity.valueMissing).toBe(false);
  });
});
