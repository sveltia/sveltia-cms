import { describe, expect, test } from 'vitest';

import { getCodeKeys, isCodeValueKey } from '$lib/services/contents/fields/code/helpers';

/**
 * @import { CodeField } from '$lib/types/public';
 */

/** @type {CodeField} */
const baseField = { name: 'snippet', widget: 'code' };

describe('getCodeKeys()', () => {
  test('returns the default keys', () => {
    expect(getCodeKeys(baseField)).toEqual({ code: 'code', lang: 'lang' });
  });

  test('returns the custom keys', () => {
    const keys = { code: 'source', lang: 'language' };

    expect(getCodeKeys({ ...baseField, keys })).toBe(keys);
  });

  test('returns `undefined` with the `output_code_only` option', () => {
    expect(getCodeKeys({ ...baseField, output_code_only: true })).toBeUndefined();
  });
});

describe('isCodeValueKey()', () => {
  test('matches the code and language keys', () => {
    expect(isCodeValueKey(baseField, 'code')).toBe(true);
    expect(isCodeValueKey(baseField, 'lang')).toBe(true);
    expect(isCodeValueKey(baseField, 'other')).toBe(false);
  });

  test('matches nothing with the `output_code_only` option', () => {
    expect(isCodeValueKey({ ...baseField, output_code_only: true }, 'code')).toBe(false);
  });
});
