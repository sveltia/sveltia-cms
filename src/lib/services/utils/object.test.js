import { unflatten } from 'flat';
import { TomlDate } from 'smol-toml';
import { describe, expect, test } from 'vitest';

import { isValueEmpty, unflattenMap } from '$lib/services/utils/object';

describe('unflattenMap()', () => {
  test('keeps the children of a placeholder written after them', () => {
    // A Code field appends the empty object at its own key path once the editor has written the
    // sub-values, so the placeholder trails its children in the value map
    const content = {
      'code.lang': 'js',
      'code.code': 'hello',
      __sc_component_name: 'custom-code',
      code: {},
    };

    // The `flat` library alone drops them
    expect(unflatten(content)).toEqual({ code: {}, __sc_component_name: 'custom-code' });

    expect(unflattenMap(content)).toEqual({
      code: { lang: 'js', code: 'hello' },
      __sc_component_name: 'custom-code',
    });
  });

  test('keeps the children of a placeholder written before them', () => {
    expect(unflattenMap({ code: {}, 'code.lang': 'js', 'code.code': 'hello' })).toEqual({
      code: { lang: 'js', code: 'hello' },
    });
  });

  test('keeps List field items at their own indexes', () => {
    const content = {
      'items.10.name': 'k',
      'items.2.name': 'c',
      'items.0.name': 'a',
      items: [],
    };

    const { items } = unflattenMap(content);

    expect(items[0]).toEqual({ name: 'a' });
    expect(items[2]).toEqual({ name: 'c' });
    expect(items[10]).toEqual({ name: 'k' });
  });

  test('handles nested placeholders', () => {
    const content = {
      'obj.snippet.lang': 'css',
      'obj.snippet.code': 'a{}',
      'obj.snippet': {},
      obj: {},
    };

    expect(unflattenMap(content)).toEqual({
      obj: { snippet: { lang: 'css', code: 'a{}' } },
    });
  });

  test('returns an empty object for empty content', () => {
    expect(unflattenMap({})).toEqual({});
  });

  test('passes nullish content through, like the `flat` library does', () => {
    expect(unflattenMap(undefined)).toBeUndefined();
    expect(unflattenMap(null)).toBeNull();
  });
});

describe('Test isValueEmpty()', () => {
  test('returns true for undefined', () => {
    expect(isValueEmpty(undefined)).toBe(true);
  });

  test('returns true for null', () => {
    expect(isValueEmpty(null)).toBe(true);
  });

  test('returns true for empty string', () => {
    expect(isValueEmpty('')).toBe(true);
  });

  test('returns true for empty array', () => {
    expect(isValueEmpty([])).toBe(true);
  });

  test('returns true for empty object', () => {
    expect(isValueEmpty({})).toBe(true);
  });

  test('returns false for boolean false (valid falsy value)', () => {
    expect(isValueEmpty(false)).toBe(false);
  });

  test('returns false for number zero (valid falsy value)', () => {
    expect(isValueEmpty(0)).toBe(false);
  });

  test('returns false for boolean true', () => {
    expect(isValueEmpty(true)).toBe(false);
  });

  test('returns false for positive numbers', () => {
    expect(isValueEmpty(1)).toBe(false);
    expect(isValueEmpty(42)).toBe(false);
    expect(isValueEmpty(3.14)).toBe(false);
  });

  test('returns false for negative numbers', () => {
    expect(isValueEmpty(-1)).toBe(false);
    expect(isValueEmpty(-42)).toBe(false);
    expect(isValueEmpty(-3.14)).toBe(false);
  });

  test('returns false for non-empty strings', () => {
    expect(isValueEmpty('hello')).toBe(false);
    expect(isValueEmpty(' ')).toBe(false); // space is not empty
    expect(isValueEmpty('0')).toBe(false); // string '0' is not empty
    expect(isValueEmpty('false')).toBe(false); // string 'false' is not empty
  });

  test('returns false for arrays with elements', () => {
    expect(isValueEmpty([1])).toBe(false);
    expect(isValueEmpty([''])).toBe(false); // array with empty string is not empty
    expect(isValueEmpty([null])).toBe(false); // array with null is not empty
    expect(isValueEmpty([undefined])).toBe(false); // array with undefined is not empty
    expect(isValueEmpty([1, 2, 3])).toBe(false);
  });

  test('returns false for objects with properties', () => {
    expect(isValueEmpty({ a: 1 })).toBe(false);
    expect(isValueEmpty({ key: '' })).toBe(false); // object with empty string value is not empty
    expect(isValueEmpty({ key: null })).toBe(false); // object with null value is not empty
    // object with undefined value is not empty
    expect(isValueEmpty({ key: undefined })).toBe(false);
    expect(isValueEmpty({ a: 1, b: 2 })).toBe(false);
  });

  test('returns false for functions', () => {
    expect(isValueEmpty(() => {})).toBe(false);
  });

  test('returns false for a Date, including a TomlDate, which has no enumerable keys', () => {
    expect(isValueEmpty(new Date())).toBe(false);
    expect(isValueEmpty(new TomlDate('2026-09-24T10:00:00Z'))).toBe(false);
  });

  test('returns false for other non-plain objects', () => {
    expect(isValueEmpty(/test/)).toBe(false);
    expect(isValueEmpty(new Set())).toBe(false);
    expect(isValueEmpty(new Map())).toBe(false);
  });

  test('returns true for an empty object without a prototype', () => {
    expect(isValueEmpty(Object.create(null))).toBe(true);
  });

  test('handles edge cases with nested empty structures', () => {
    // Arrays containing only empty values are still not empty
    expect(isValueEmpty([{}])).toBe(false);
    expect(isValueEmpty([[]])).toBe(false);
    expect(isValueEmpty([''])).toBe(false);

    // Objects with empty values are still not empty
    expect(isValueEmpty({ nested: {} })).toBe(false);
    expect(isValueEmpty({ arr: [] })).toBe(false);
    expect(isValueEmpty({ str: '' })).toBe(false);
  });

  test('handles special number values', () => {
    expect(isValueEmpty(NaN)).toBe(false); // NaN is not considered empty
    expect(isValueEmpty(Infinity)).toBe(false);
    expect(isValueEmpty(-Infinity)).toBe(false);
  });

  test('handles bigint values', () => {
    expect(isValueEmpty(0n)).toBe(false); // BigInt 0 is not considered empty
    expect(isValueEmpty(1n)).toBe(false);
  });

  test('handles symbol values', () => {
    expect(isValueEmpty(Symbol('test'))).toBe(false);
    expect(isValueEmpty(Symbol.iterator)).toBe(false);
  });

  test('handles objects with non-enumerable properties', () => {
    const obj = {};

    Object.defineProperty(obj, 'hidden', {
      value: 'test',
      enumerable: false,
    });

    // Object.keys() only returns enumerable properties, so this is empty
    expect(isValueEmpty(obj)).toBe(true);
  });

  test('comprehensive validation of the specific empty values mentioned in comments', () => {
    // These are the specific values mentioned in the JSDoc comment
    expect(isValueEmpty(undefined)).toBe(true);
    expect(isValueEmpty(null)).toBe(true);
    expect(isValueEmpty('')).toBe(true);
    expect(isValueEmpty([])).toBe(true);
    expect(isValueEmpty({})).toBe(true);

    // And confirming that false and 0 are NOT empty (as mentioned in the comment)
    expect(isValueEmpty(false)).toBe(false);
    expect(isValueEmpty(0)).toBe(false);
  });
});
