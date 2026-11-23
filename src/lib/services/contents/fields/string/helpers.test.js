import { describe, expect, test } from 'vitest';

import { getStringFieldValue, getStringInputValue } from './helpers.js';

/**
 * @import { StringField } from '$lib/types/public';
 */

/**
 * Build a String field configuration.
 * @param {Partial<StringField>} [config] Field options.
 * @returns {StringField} Field configuration.
 */
const createField = (config = {}) => ({ name: 'handle', widget: 'string', ...config });

describe('getStringInputValue()', () => {
  test('passes a string through', () => {
    expect(getStringInputValue({ currentValue: 'hello', fieldConfig: createField() })).toBe(
      'hello',
    );
  });

  test('converts a non-string value to a string', () => {
    expect(getStringInputValue({ currentValue: 42, fieldConfig: createField() })).toBe('42');
    expect(getStringInputValue({ currentValue: true, fieldConfig: createField() })).toBe('true');
    expect(getStringInputValue({ currentValue: undefined, fieldConfig: createField() })).toBe('');
    expect(getStringInputValue({ currentValue: null, fieldConfig: createField() })).toBe('');
  });

  test('strips the affixes', () => {
    const fieldConfig = createField({ prefix: '@', suffix: '.eth' });

    expect(getStringInputValue({ currentValue: '@vitalik.eth', fieldConfig })).toBe('vitalik');
    expect(getStringInputValue({ currentValue: '@vitalik', fieldConfig })).toBe('vitalik');
    expect(getStringInputValue({ currentValue: 'vitalik.eth', fieldConfig })).toBe('vitalik');
    expect(getStringInputValue({ currentValue: 'vitalik', fieldConfig })).toBe('vitalik');
    expect(getStringInputValue({ currentValue: '', fieldConfig })).toBe('');
  });
});

describe('getStringFieldValue()', () => {
  test('passes a value through when the field has no affixes', () => {
    expect(getStringFieldValue({ inputValue: 'hello', fieldConfig: createField() })).toBe('hello');
    expect(getStringFieldValue({ inputValue: '', fieldConfig: createField() })).toBe('');
  });

  test('adds the affixes to a non-blank value', () => {
    const fieldConfig = createField({ prefix: '@', suffix: '.eth' });

    expect(getStringFieldValue({ inputValue: 'vitalik', fieldConfig })).toBe('@vitalik.eth');
    expect(
      getStringFieldValue({ inputValue: 'vitalik', fieldConfig: createField({ prefix: '@' }) }),
    ).toBe('@vitalik');
  });

  test('leaves a blank value alone', () => {
    const fieldConfig = createField({ prefix: '@', suffix: '.eth' });

    expect(getStringFieldValue({ inputValue: '', fieldConfig })).toBe('');
    expect(getStringFieldValue({ inputValue: '  ', fieldConfig })).toBe('  ');
  });
});
