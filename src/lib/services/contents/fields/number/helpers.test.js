import { describe, expect, test } from 'vitest';

import { getNumberFieldValue, getNumberInputValue } from './helpers.js';

/**
 * @import { NumberField } from '$lib/types/public';
 */

/**
 * Build a Number field configuration.
 * @param {NumberField['value_type']} [valueType] Value type.
 * @returns {NumberField} Field configuration.
 */
const createField = (valueType) => ({ name: 'count', widget: 'number', value_type: valueType });

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

  test('returns `NaN` for a blank string, so the input is emptied', () => {
    expect(getNumberInputValue({ currentValue: '', fieldConfig: createField() })).toBeNaN();
    expect(getNumberInputValue({ currentValue: '  ', fieldConfig: createField() })).toBeNaN();
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
