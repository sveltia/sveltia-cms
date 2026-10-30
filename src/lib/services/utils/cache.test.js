import { describe, expect, test, vi } from 'vitest';

import {
  createLRUMap,
  getOrCreate,
  getOrCreateAsync,
  getOrCreateBounded,
  lazy,
  memoizeOnSource,
  shareInFlight,
} from './cache';

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

describe('Test createLRUMap()', () => {
  test('stores and returns values', () => {
    const map = createLRUMap(2);

    map.set('a', 1);

    expect(map.has('a')).toBe(true);
    expect(map.get('a')).toBe(1);
    expect(map.has('b')).toBe(false);
    expect(map.get('b')).toBeUndefined();
  });

  test('keeps an `undefined` value, which `has` tells apart from a missing one', () => {
    const map = createLRUMap(2);

    map.set('a', undefined);

    expect(map.has('a')).toBe(true);
    expect(map.get('a')).toBeUndefined();
  });

  test('evicts the oldest entry once the limit is exceeded', () => {
    const map = createLRUMap(2);

    map.set('a', 1);
    map.set('b', 2);
    map.set('c', 3);

    expect(map.has('a')).toBe(false);
    expect(map.has('b')).toBe(true);
    expect(map.has('c')).toBe(true);
  });

  test('keeps an entry read with `get` and evicts the least recently used one', () => {
    const map = createLRUMap(2);

    map.set('a', 1);
    map.set('b', 2);
    map.get('a');
    map.set('c', 3);

    expect(map.has('a')).toBe(true);
    expect(map.has('b')).toBe(false);
  });

  test('doesn’t mark an entry checked with `has` as recently used', () => {
    const map = createLRUMap(2);

    map.set('a', 1);
    map.set('b', 2);
    map.has('a');
    map.set('c', 3);

    expect(map.has('a')).toBe(false);
  });

  test('marks an overwritten entry as recently used', () => {
    const map = createLRUMap(2);

    map.set('a', 1);
    map.set('b', 2);
    map.set('a', 3);
    map.set('c', 4);

    expect(map.get('a')).toBe(3);
    expect(map.has('b')).toBe(false);
  });

  test('clears all the entries', () => {
    const map = createLRUMap(2);

    map.set('a', 1);
    map.clear();

    expect(map.has('a')).toBe(false);
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

describe('Test shareInFlight()', () => {
  test('shares a pending task, then forgets it once settled', async () => {
    const cache = new Map();
    let calls = 0;

    /**
     * Count the calls, resolving with the running total.
     * @returns {Promise<number>} Number of calls so far.
     */
    const create = async () => {
      calls += 1;

      return calls;
    };

    const first = shareInFlight(cache, 'a', create);

    expect(shareInFlight(cache, 'a', create)).toBe(first);
    await expect(first).resolves.toBe(1);
    expect(cache.has('a')).toBe(false);
    await expect(shareInFlight(cache, 'a', create)).resolves.toBe(2);
  });

  test('forgets a failed task', async () => {
    const cache = new Map();

    await expect(shareInFlight(cache, 'a', () => Promise.reject(new Error('x')))).rejects.toThrow();
    expect(cache.has('a')).toBe(false);
  });
});

describe('Test getOrCreateAsync()', () => {
  test('remembers a successful result', async () => {
    const cache = new Map();
    const first = getOrCreateAsync(cache, 'a', async () => 1);

    await expect(first).resolves.toBe(1);
    expect(getOrCreateAsync(cache, 'a', async () => 2)).toBe(first);
  });

  test('forgets a failure, so a later caller can try again', async () => {
    const cache = new Map();

    await expect(
      getOrCreateAsync(cache, 'a', () => Promise.reject(new Error('x'))),
    ).rejects.toThrow('x');
    expect(cache.has('a')).toBe(false);
    await expect(getOrCreateAsync(cache, 'a', async () => 2)).resolves.toBe(2);
  });
});

describe('Test memoizeOnSource()', () => {
  test('builds the value once per source, and again once the source is replaced', () => {
    let source = [1, 2];
    const build = vi.fn((/** @type {number[]} */ items) => items.length);
    const getValue = memoizeOnSource(() => source, build);

    expect(getValue()).toBe(2);
    expect(getValue()).toBe(2);
    expect(build).toHaveBeenCalledOnce();

    source = [1, 2, 3];

    expect(getValue()).toBe(3);
    expect(build).toHaveBeenCalledTimes(2);
  });

  test('also caches a value built from an undefined source', () => {
    const build = vi.fn(() => 'x');
    const getValue = memoizeOnSource(() => undefined, build);

    expect(getValue()).toBe('x');
    expect(getValue()).toBe('x');
    expect(build).toHaveBeenCalledOnce();
  });
});

describe('Test lazy()', () => {
  test('builds the value on first use only', () => {
    const create = vi.fn(() => ({}));
    const getValue = lazy(create);

    expect(create).not.toHaveBeenCalled();

    const value = getValue();

    expect(getValue()).toBe(value);
    expect(create).toHaveBeenCalledOnce();
  });

  test('also caches an undefined value', () => {
    const create = vi.fn(() => undefined);
    const getValue = lazy(create);

    expect(getValue()).toBeUndefined();
    expect(getValue()).toBeUndefined();
    expect(create).toHaveBeenCalledOnce();
  });
});
