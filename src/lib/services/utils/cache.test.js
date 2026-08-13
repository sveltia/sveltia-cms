import { describe, expect, test } from 'vitest';

import { getOrCreate, getOrCreateBounded } from './cache';

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

describe('Test getOrCreateBounded()', () => {
  test('calls create and stores value when key is absent', () => {
    const cache = new Map();
    const result = getOrCreateBounded(cache, 'key', () => 'value', 10);

    expect(result).toBe('value');
    expect(cache.get('key')).toBe('value');
  });

  test('returns cached value without calling create a second time', () => {
    const cache = new Map();
    let calls = 0;

    getOrCreateBounded(
      cache,
      'key',
      () => {
        calls += 1;
        return 'value';
      },
      10,
    );

    const result = getOrCreateBounded(
      cache,
      'key',
      () => {
        calls += 1;
        return 'other';
      },
      10,
    );

    expect(result).toBe('value');
    expect(calls).toBe(1);
  });

  test('caches falsy values instead of recomputing them', () => {
    const cache = new Map();
    let calls = 0;

    /**
     * Count the calls and always return `undefined`.
     * @returns {any} Nothing.
     */
    const create = () => {
      calls += 1;

      return undefined;
    };

    expect(getOrCreateBounded(cache, 'key', create, 10)).toBe(undefined);
    expect(getOrCreateBounded(cache, 'key', create, 10)).toBe(undefined);
    expect(calls).toBe(1);
  });

  test('evicts the oldest entry once the limit is exceeded', () => {
    const cache = new Map();

    ['a', 'b', 'c'].forEach((key) => getOrCreateBounded(cache, key, () => key, 2));

    expect(cache.size).toBe(2);
    expect([...cache.keys()]).toEqual(['b', 'c']);
  });

  test('keeps recently read entries and evicts the least recently used one', () => {
    const cache = new Map();

    ['a', 'b'].forEach((key) => getOrCreateBounded(cache, key, () => key, 2));
    // Reading `a` makes `b` the least recently used entry
    getOrCreateBounded(cache, 'a', () => 'unused', 2);
    getOrCreateBounded(cache, 'c', () => 'c', 2);

    expect([...cache.keys()]).toEqual(['a', 'c']);
  });

  test('never grows beyond the limit', () => {
    const cache = new Map();

    Array.from({ length: 500 }, (_, i) => i).forEach((i) =>
      getOrCreateBounded(cache, `key-${i}`, () => i, 5),
    );

    expect(cache.size).toBe(5);
    expect([...cache.keys()]).toEqual(['key-495', 'key-496', 'key-497', 'key-498', 'key-499']);
  });
});
