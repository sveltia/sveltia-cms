import { describe, expect, test } from 'vitest';

import {
  getObjectId,
  getOptionLabelMap,
} from '$lib/services/contents/fields/relation/helpers/cache';

describe('getOptionLabelMap', () => {
  test('indexes option labels by value', () => {
    const options = [
      { value: 'a', label: 'Alpha' },
      { value: 1, label: 'One' },
    ];

    const map = getOptionLabelMap(/** @type {any} */ (options));

    expect([...map]).toEqual([
      ['a', 'Alpha'],
      [1, 'One'],
    ]);
  });

  test('keeps the first label for a duplicate value', () => {
    const options = [
      { value: 'a', label: 'First' },
      { value: 'a', label: 'Second' },
    ];

    expect(getOptionLabelMap(/** @type {any} */ (options)).get('a')).toBe('First');
  });

  test('returns an empty map for no options', () => {
    expect(getOptionLabelMap([]).size).toBe(0);
  });

  test('returns the cached map for the same array and a new one for another array', () => {
    const options = [{ value: 'a', label: 'Alpha' }];
    const map = getOptionLabelMap(/** @type {any} */ (options));

    // The cache is keyed by the array itself, so a change made to it in place is not picked up
    options.push({ value: 'b', label: 'Beta' });
    expect(getOptionLabelMap(/** @type {any} */ (options))).toBe(map);
    expect(map.has('b')).toBe(false);

    const otherMap = getOptionLabelMap(/** @type {any} */ ([...options]));

    expect(otherMap).not.toBe(map);
    expect(otherMap.get('b')).toBe('Beta');
  });
});

describe('getObjectId', () => {
  test('returns the same identity for the same object', () => {
    const obj = {};

    expect(getObjectId(obj)).toBe(getObjectId(obj));
  });

  test('returns distinct, increasing identities for different objects', () => {
    const a = getObjectId({});
    const b = getObjectId({});
    const c = getObjectId([]);

    expect(Number.isInteger(a)).toBe(true);
    expect(b).toBe(a + 1);
    expect(c).toBe(b + 1);
  });

  test('identifies objects by reference rather than by content', () => {
    expect(getObjectId({ x: 1 })).not.toBe(getObjectId({ x: 1 }));
  });
});
