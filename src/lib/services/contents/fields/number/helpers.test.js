import { describe, expect, test } from 'vitest';

import {
  getNumberFieldValue,
  getNumberFormatter,
  getNumberInputValue,
  isFloatType,
  isInvalidNumberValue,
} from './helpers.js';

/**
 * @import { NumberField } from '$lib/types/public';
 */

/**
 * Build a Number field configuration.
 * @param {NumberField['value_type']} [valueType] Value type.
 * @returns {NumberField} Field configuration.
 */
const createField = (valueType) => ({ name: 'count', widget: 'number', value_type: valueType });

describe('isFloatType()', () => {
  test('returns true for the floating-point types', () => {
    expect(isFloatType(createField('float'))).toBe(true);
    expect(isFloatType(createField('float/string'))).toBe(true);
  });

  test('returns false for the integer types, a custom type and the default', () => {
    expect(isFloatType(createField('int'))).toBe(false);
    expect(isFloatType(createField('int/string'))).toBe(false);
    expect(isFloatType(createField(/** @type {any} */ ('custom')))).toBe(false);
    expect(isFloatType(createField())).toBe(false);
  });
});

describe('getNumberInputValue()', () => {
  test('passes a number through', () => {
    expect(getNumberInputValue({ currentValue: 42, fieldConfig: createField() })).toBe(42);
    expect(getNumberInputValue({ currentValue: 1.5, fieldConfig: createField('float') })).toBe(1.5);
  });

  test('returns `undefined` when there is no value', () => {
    expect(getNumberInputValue({ currentValue: undefined, fieldConfig: createField() })).toBe(
      undefined,
    );
    expect(getNumberInputValue({ currentValue: null, fieldConfig: createField() })).toBe(undefined);
  });

  test('returns `undefined` for a blank string, so the input is emptied rather than showing NaN', () => {
    expect(getNumberInputValue({ currentValue: '', fieldConfig: createField() })).toBe(undefined);
    expect(
      getNumberInputValue({ currentValue: '  ', fieldConfig: createField('float/string') }),
    ).toBe(undefined);
  });

  test('parses a string as an integer by default', () => {
    expect(getNumberInputValue({ currentValue: '42', fieldConfig: createField() })).toBe(42);
    expect(getNumberInputValue({ currentValue: '42.9', fieldConfig: createField() })).toBe(42);
    expect(
      getNumberInputValue({ currentValue: '42', fieldConfig: createField('int/string') }),
    ).toBe(42);
  });

  test('parses a string as a float for the float types', () => {
    expect(getNumberInputValue({ currentValue: '42.9', fieldConfig: createField('float') })).toBe(
      42.9,
    );
    expect(
      getNumberInputValue({ currentValue: '42.9', fieldConfig: createField('float/string') }),
    ).toBe(42.9);
  });

  test('returns `undefined` for a string that is not a number', () => {
    expect(getNumberInputValue({ currentValue: 'abc', fieldConfig: createField() })).toBe(
      undefined,
    );
    expect(getNumberInputValue({ currentValue: 'abc', fieldConfig: createField('float') })).toBe(
      undefined,
    );
  });
});

describe('getNumberFieldValue()', () => {
  test('stores an integer for the `int` type', () => {
    expect(getNumberFieldValue({ inputValue: 42, fieldConfig: createField() })).toBe(42);
    expect(getNumberFieldValue({ inputValue: 42.9, fieldConfig: createField('int') })).toBe(42);
  });

  test('stores a float for the `float` type', () => {
    expect(getNumberFieldValue({ inputValue: 42.9, fieldConfig: createField('float') })).toBe(42.9);
  });

  test('stores a string for the string types', () => {
    expect(getNumberFieldValue({ inputValue: 42.9, fieldConfig: createField('int/string') })).toBe(
      '42',
    );
    expect(
      getNumberFieldValue({ inputValue: 42.9, fieldConfig: createField('float/string') }),
    ).toBe('42.9');
    // Any other `value_type` is stored as a string, too
    expect(
      getNumberFieldValue({
        inputValue: 42,
        fieldConfig: createField(/** @type {any} */ ('custom')),
      }),
    ).toBe('42');
  });

  test('stores `null` for an empty input with the number types', () => {
    expect(getNumberFieldValue({ inputValue: undefined, fieldConfig: createField() })).toBe(null);
    expect(getNumberFieldValue({ inputValue: NaN, fieldConfig: createField('float') })).toBe(null);
  });

  test('stores an empty string for an empty input with the string types', () => {
    expect(
      getNumberFieldValue({ inputValue: undefined, fieldConfig: createField('int/string') }),
    ).toBe('');
    expect(getNumberFieldValue({ inputValue: NaN, fieldConfig: createField('float/string') })).toBe(
      '',
    );
  });
});

describe('Invalid input handling', () => {
  test('parses a whole string rather than its leading digits', () => {
    expect(getNumberInputValue({ currentValue: '1e3', fieldConfig: createField() })).toBe(1000);
    expect(
      getNumberInputValue({ currentValue: '1e3', fieldConfig: createField('int/string') }),
    ).toBe(1000);
    expect(getNumberInputValue({ currentValue: '12px', fieldConfig: createField() })).toBe(
      undefined,
    );
    expect(getNumberInputValue({ currentValue: '-0', fieldConfig: createField() })).toBe(0);
    // An integer beyond the safe range, or a non-finite number, can’t be shown
    expect(getNumberInputValue({ currentValue: '1e21', fieldConfig: createField() })).toBe(
      undefined,
    );
    expect(
      getNumberInputValue({ currentValue: 'Infinity', fieldConfig: createField('float') }),
    ).toBe(undefined);
  });

  test('keeps the input that the stored invalid value was converted from', () => {
    expect(
      getNumberInputValue({ currentValue: '1,5', fieldConfig: createField(), inputValue: '1,5' }),
    ).toBe('1,5');
    expect(
      getNumberInputValue({
        currentValue: 'Infinity',
        fieldConfig: createField('float'),
        inputValue: Infinity,
      }),
    ).toBe(Infinity);
    expect(
      getNumberInputValue({ currentValue: '1e+21', fieldConfig: createField(), inputValue: 1e21 }),
    ).toBe(1e21);
    // An invalid value from elsewhere replaces the input
    expect(
      getNumberInputValue({ currentValue: 'abc', fieldConfig: createField(), inputValue: '1,5' }),
    ).toBe(undefined);
    // A valid value is converted as usual
    expect(
      getNumberInputValue({ currentValue: 1, fieldConfig: createField(), inputValue: 1.5 }),
    ).toBe(1);
  });

  test('stores text that isn’t a number as is', () => {
    expect(getNumberFieldValue({ inputValue: '1,5', fieldConfig: createField('float') })).toBe(
      '1,5',
    );
    expect(getNumberFieldValue({ inputValue: 'abc', fieldConfig: createField('int/string') })).toBe(
      'abc',
    );
  });

  test('stores a number the field can’t hold as a string', () => {
    expect(getNumberFieldValue({ inputValue: Infinity, fieldConfig: createField('float') })).toBe(
      'Infinity',
    );
    expect(getNumberFieldValue({ inputValue: -Infinity, fieldConfig: createField() })).toBe(
      '-Infinity',
    );
    expect(getNumberFieldValue({ inputValue: 1e21, fieldConfig: createField() })).toBe('1e+21');
    expect(
      getNumberFieldValue({ inputValue: 2 ** 53, fieldConfig: createField('int/string') }),
    ).toBe('9007199254740992');
    // A large float is fine
    expect(getNumberFieldValue({ inputValue: 1e21, fieldConfig: createField('float') })).toBe(1e21);
    expect(getNumberFieldValue({ inputValue: 2 ** 53 - 1, fieldConfig: createField() })).toBe(
      2 ** 53 - 1,
    );
  });

  test('stores zero rather than negative zero', () => {
    expect(Object.is(getNumberFieldValue({ inputValue: -0, fieldConfig: createField() }), 0)).toBe(
      true,
    );
    expect(
      Object.is(getNumberFieldValue({ inputValue: -0.4, fieldConfig: createField() }), 0),
    ).toBe(true);
    expect(
      Object.is(getNumberFieldValue({ inputValue: -0, fieldConfig: createField('float') }), 0),
    ).toBe(true);
  });

  test('tells whether a stored value is invalid', () => {
    [null, undefined, '', '  ', 0, 42, '42', 1.5, '1.5', '1e3'].forEach((value) => {
      expect(isInvalidNumberValue(value, createField())).toBe(false);
    });
    ['1,5', 'abc', 'Infinity', Infinity, NaN, '1e+21', 2 ** 53].forEach((value) => {
      expect(isInvalidNumberValue(value, createField())).toBe(true);
    });
    expect(isInvalidNumberValue(1e21, createField('float'))).toBe(false);
    expect(isInvalidNumberValue(-Infinity, createField('float'))).toBe(true);
  });
});

describe('getNumberFormatter()', () => {
  test('keeps every fraction digit', () => {
    expect(getNumberFormatter('en').format(35.681236)).toBe('35.681236');
    expect(getNumberFormatter('en').format(0.0004)).toBe('0.0004');
    expect(getNumberFormatter('en').format(1234567.891)).toBe('1,234,567.891');
    expect(getNumberFormatter('ja').format(0.1)).toBe('0.1');
  });

  test('caches the formatter for each locale', () => {
    expect(getNumberFormatter('de')).toBe(getNumberFormatter('de'));
    expect(getNumberFormatter('de')).not.toBe(getNumberFormatter('en'));
  });
});
