import { unflatten } from 'flat';
import { TomlDate } from 'smol-toml';
import { describe, expect, test } from 'vitest';

import {
  escapeKeySegment,
  flattenKeys,
  hasIndexLikeChildKey,
  isValueEmpty,
  unescapeKeySegment,
  unflattenKeys,
  unflattenMap,
} from '$lib/services/utils/object';

describe('escapeKeySegment() and unescapeKeySegment()', () => {
  test('leaves a key without a dot as it is', () => {
    expect(escapeKeySegment('title')).toBe('title');
    expect(escapeKeySegment('')).toBe('');
    expect(unescapeKeySegment('title')).toBe('title');
  });

  test('escapes dots, so the segment holds none', () => {
    expect(escapeKeySegment('example.com')).toBe('example\uE000com');
    expect(escapeKeySegment('.a..b.')).toBe('\uE000a\uE000\uE000b\uE000');
    expect(unescapeKeySegment('example\uE000com')).toBe('example.com');
    expect(unescapeKeySegment('\uE000a\uE000\uE000b\uE000')).toBe('.a..b.');
  });

  test('escapes the escape characters themselves, so any key round-trips', () => {
    ['\uE000', '\uE001', 'a.\uE000.\uE001b', '\uE001\uE000', '\uE001.'].forEach((key) => {
      expect(escapeKeySegment(key)).not.toContain('.');
      expect(unescapeKeySegment(escapeKeySegment(key))).toBe(key);
    });
  });
});

describe('flattenKeys()', () => {
  test('flattens like the `flat` library, escaping the dots in object keys', () => {
    expect(
      flattenKeys({
        title: 'Hello',
        redirects: { 'example.com': 'a', 'v1.2': 'b' },
        list: [{ 'a.b': 1 }, 'x'],
        empty: {},
      }),
    ).toEqual({
      title: 'Hello',
      'redirects.example\uE000com': 'a',
      'redirects.v1\uE0002': 'b',
      'list.0.a\uE000b': 1,
      'list.1': 'x',
      empty: {},
    });
  });

  test('prefixes the key paths', () => {
    expect(flattenKeys({ 'a.b': 1, c: [2] }, 'list.0')).toEqual({
      'list.0.a\uE000b': 1,
      'list.0.c.0': 2,
    });
  });

  test('stores an empty value at the prefix itself', () => {
    const list = /** @type {any[]} */ ([]);

    expect(flattenKeys(list, 'list')).toEqual({ list: [] });
    expect(flattenKeys(list, 'list').list).toBe(list);
    expect(flattenKeys({}, 'obj')).toEqual({ obj: {} });
    expect(flattenKeys({})).toEqual({});
  });

  test('round-trips with `unflattenKeys()`', () => {
    const value = {
      'nav.home': 'Home',
      redirects: { 'example.com': 'a', 'v1.2': 'b', 1.5: 'c', '.': 'd', '': 'e' },
      list: [{ kv: { 'a.b': { 'c.d': [1, { 'e.f': 2 }] } } }],
      '\uE000.\uE001': 'escape characters',
    };

    expect(unflattenKeys(flattenKeys(value))).toEqual(value);
    expect(unflattenMap(flattenKeys(value))).toEqual(value);
  });

  test('adds a placeholder ahead of an object with a key that looks like a list index', () => {
    expect(
      flattenKeys({
        years: { 2023: 'a', 2024: 'b' },
        mixed: { a: 1, 0: 'x' },
        list: ['x', { meta: { 1: 'y' } }],
        plain: { a: 1 },
      }),
    ).toEqual({
      years: {},
      'years.2023': 'a',
      'years.2024': 'b',
      mixed: {},
      'mixed.0': 'x',
      'mixed.a': 1,
      'list.0': 'x',
      'list.1.meta': {},
      'list.1.meta.1': 'y',
      'plain.a': 1,
    });
    expect(Object.keys(flattenKeys({ o: { 5: 'a' } }))).toEqual(['o', 'o.5']);
    // The root is always an object, so it needs no placeholder, unless it has a prefix
    expect(flattenKeys({ 10: 'a' })).toEqual({ 10: 'a' });
    expect(flattenKeys({ 10: 'a' }, 'map')).toEqual({ map: {}, 'map.10': 'a' });
    expect(flattenKeys(['a'], 'list')).toEqual({ 'list.0': 'a' });
  });

  test('round-trips an object with keys that look like list indexes', () => {
    // The `flat` library alone turns such an object into a sparse array
    expect(unflatten({ 'map.10': 'a' })).toEqual({ map: [...Array(10), 'a'] });

    const value = {
      10: 'root',
      years: { 2023: 'a', 2024: 'b' },
      zero: { 0: 'x', 1: 'y' },
      mixed: { a: 1, 3: 'c', 'd.e': 'f', '': 'g' },
      list: [{ hidden: { 1: 'x' } }, ['y', { 0: 'z' }]],
    };

    expect(unflattenKeys(flattenKeys(value))).toEqual(value);
    expect(unflattenMap(flattenKeys(value))).toEqual(value);
    expect(unflattenKeys({ hidden: { 0: 'x', 1: { 2: 'y' } } })).toEqual({
      hidden: { 0: 'x', 1: { 2: 'y' } },
    });
  });
});

describe('hasIndexLikeChildKey()', () => {
  test('checks whether an object at a key path has a key that looks like a list index', () => {
    const map = { 'o.2024': 'a', 'p.a': 'b', 'p.1x': 'c', 'q.a.0': 'd', 'r.0.t': 'e', 'or.1': 'f' };

    expect(hasIndexLikeChildKey(map, 'o')).toBe(true);
    expect(hasIndexLikeChildKey(map, 'p')).toBe(false);
    expect(hasIndexLikeChildKey(map, 'q')).toBe(false);
    expect(hasIndexLikeChildKey(map, 'q.a')).toBe(true);
    expect(hasIndexLikeChildKey(map, 'r')).toBe(true);
    expect(hasIndexLikeChildKey(map, 'x')).toBe(false);
  });
});

describe('unflattenKeys()', () => {
  test('unflattens a map like the `flat` library', () => {
    expect(unflattenKeys({ 'a.b': 'c', 'list.0': 'x', 'list.1': 'y' })).toEqual({
      a: { b: 'c' },
      list: ['x', 'y'],
    });
  });

  test('keeps an empty key as a string key', () => {
    // The `flat` library alone turns it into an array index
    expect(unflatten({ 'kv.': '' })).toEqual({ kv: [''] });

    expect(unflattenKeys({ 'kv.': '' })).toEqual({ kv: { '': '' } });
    expect(unflattenKeys({ '': 'root' })).toEqual({ '': 'root' });
  });

  test('keeps non-index numeric keys as string keys', () => {
    const result = unflattenKeys({
      'list.0.kv.': 'empty',
      'list.0.kv. ': 'space',
      'list.0.kv.01': 'leading zero',
      'list.0.kv.-1': 'negative',
      'list.0.kv.1e3': 'exponent',
      'list.1.kv.foo': 'bar',
    });

    expect(Array.isArray(result.list)).toBe(true);
    expect(result.list).toEqual([
      {
        kv: {
          '': 'empty',
          ' ': 'space',
          '01': 'leading zero',
          '-1': 'negative',
          '1e3': 'exponent',
        },
      },
      { kv: { foo: 'bar' } },
    ]);
  });

  test('restores escaped keys', () => {
    // The `flat` library alone splits a dotted key
    expect(unflatten({ 'redirects.example.com': 'a' })).toEqual({
      redirects: { example: { com: 'a' } },
    });

    expect(
      unflattenKeys({
        'redirects.example\uE000com': 'a',
        'redirects.v1\uE0002': 'b',
        'list.0.kv.1\uE0005': 'c',
        'list.1.kv.x': 'd',
      }),
    ).toEqual({
      redirects: { 'example.com': 'a', 'v1.2': 'b' },
      list: [{ kv: { 1.5: 'c' } }, { kv: { x: 'd' } }],
    });
  });

  test('flattens a nested object value with its keys escaped', () => {
    // A Hidden field’s default value is stored as is at its own key path. The `flat` library alone
    // would split its dotted keys
    expect(
      unflattenKeys({ 'meta.x': 1, hidden: { 'a.b': { 'c.d': 1 }, list: [{ 'e.f': 2 }] } }),
    ).toEqual({ meta: { x: 1 }, hidden: { 'a.b': { 'c.d': 1 }, list: [{ 'e.f': 2 }] } });
    expect(unflattenKeys({ 'kv.': 'x', nested: { '01': 'y' } })).toEqual({
      kv: { '': 'x' },
      nested: { '01': 'y' },
    });
  });

  test('leaves class instances as they are', () => {
    const date = new Date();
    const result = unflattenKeys({ 'a.': 'x', 'a.date': date });

    expect(result).toEqual({ a: { '': 'x', date } });
    expect(result.a.date).toBe(date);
  });
});

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

  test('keeps an empty key of a KeyValue field in a List field item', () => {
    expect(unflattenMap({ 'list.0.kv.': 'value', 'list.0.title': 'a' })).toEqual({
      list: [{ kv: { '': 'value' }, title: 'a' }],
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
