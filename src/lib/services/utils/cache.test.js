import { describe, expect, test } from 'vitest';

import { getOrCreate } from './cache';

describe('Test getOrCreate()', () => {
  test('calls create and stores value when key is absent', () => {
    const cache = new Map();
    const result = getOrCreate(cache, 'key', () => 'value');

    expect(result).toBe('value');
    expect(cache.get('key')).toBe('value');
  });

  test('returns cached value without calling create a second time', () => {
    const cache = new Map();
    let calls = 0;

    getOrCreate(cache, 'key', () => {
      calls += 1;
      return 'value';
    });

    const result = getOrCreate(cache, 'key', () => {
      calls += 1;
      return 'other';
    });

    expect(result).toBe('value');
    expect(calls).toBe(1);
  });

  test('stores and retrieves RegExp objects', () => {
    /** @type {Map<string, RegExp>} */
    const cache = new Map();
    const re = getOrCreate(cache, 'foo', () => /^foo\.\d+$/);

    expect(re).toBeInstanceOf(RegExp);
    expect(re.test('foo.0')).toBe(true);
    expect(re.test('bar.0')).toBe(false);
  });

  test('different keys produce independent entries', () => {
    const cache = new Map();
    const a = getOrCreate(cache, 'a', () => /^a/);
    const b = getOrCreate(cache, 'b', () => /^b/);

    expect(a).not.toBe(b);
    expect(a.test('alpha')).toBe(true);
    expect(b.test('beta')).toBe(true);
  });

  test('works with falsy-value keys by using has() not truthiness', () => {
    // If key is '' (empty string) the value should still be cached properly
    const cache = new Map();

    getOrCreate(cache, '', () => 'empty-key');

    const result = getOrCreate(cache, '', () => 'should-not-be-called');

    expect(result).toBe('empty-key');
    expect(cache.size).toBe(1);
  });

  test('stores object values (multi-regex case)', () => {
    /** @type {Map<string, { open: RegExp, close: RegExp }>} */
    const cache = new Map();

    const tagRegexes = getOrCreate(cache, 'div', () => ({
      open: /<div(?:[\s>])/gi,
      close: /<\/div>/gi,
    }));

    expect(tagRegexes).toHaveProperty('open');
    expect(tagRegexes).toHaveProperty('close');
    expect(cache.has('div')).toBe(true);
  });

  test('returns the same object reference on repeated calls', () => {
    const cache = new Map();
    const first = getOrCreate(cache, 'k', () => ({ x: 1 }));
    const second = getOrCreate(cache, 'k', () => ({ x: 2 }));

    expect(first).toBe(second);
  });
});
