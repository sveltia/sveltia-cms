// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

import { createRawState } from '$lib/services/utils/state.svelte';

import { buildGroupMap, initViewSettingsStorage, matchesFilter, sortItemsByKey } from './view';

const { mockDB, mockIndexedDB } = vi.hoisted(() => {
  const db = { get: vi.fn(), set: vi.fn() };

  return {
    mockDB: db,
    // eslint-disable-next-line prefer-arrow-callback, func-names
    mockIndexedDB: vi.fn(function () {
      return db;
    }),
  };
});

vi.mock('@sveltia/utils/storage', () => ({
  IndexedDB: mockIndexedDB,
}));

vi.mock('@sveltia/utils/string', () => ({
  compare: vi.fn((a, b) => {
    if (String(a) < String(b)) return -1;
    if (String(a) > String(b)) return 1;
    return 0;
  }),
}));

vi.mock('$lib/services/utils/regex', () => ({
  getRegex: vi.fn(),
}));

describe('Test buildGroupMap()', () => {
  /** @type {import('vitest').MockedFunction<any>} */
  let getRegexMock;

  beforeEach(async () => {
    vi.clearAllMocks();

    const { getRegex } = await import('$lib/services/utils/regex');

    getRegexMock = vi.mocked(getRegex);
    getRegexMock.mockReturnValue(null);
  });

  test('returns empty array for empty items list', () => {
    const result = buildGroupMap([], undefined, (item) => item, 'Other');

    expect(result).toEqual([]);
  });

  test('groups items by exact string value', () => {
    const items = [
      { id: 1, category: 'a' },
      { id: 2, category: 'b' },
      { id: 3, category: 'a' },
    ];

    const result = buildGroupMap(items, undefined, (item) => item.category, 'Other');

    expect(result).toEqual([
      ['a', [items[0], items[2]]],
      ['b', [items[1]]],
    ]);
  });

  test('groups items by numeric value (coerced to string)', () => {
    const items = [{ v: 1 }, { v: 2 }, { v: 1 }];
    const result = buildGroupMap(items, undefined, (item) => item.v, 'Other');

    expect(result).toEqual([
      ['1', [items[0], items[2]]],
      ['2', [items[1]]],
    ]);
  });

  test('places items with null value under otherKey', () => {
    const items = [{ v: 'a' }, { v: null }, { v: 'a' }];
    const result = buildGroupMap(items, undefined, (item) => item.v, 'Other');

    expect(result).toEqual([
      ['Other', [items[1]]],
      ['a', [items[0], items[2]]],
    ]);
  });

  test('places items with undefined value under otherKey', () => {
    const items = [{ v: 'a' }, {}, { v: 'a' }];
    const result = buildGroupMap(items, undefined, (item) => /** @type {any} */ (item).v, 'Other');

    expect(result).toEqual([
      ['Other', [items[1]]],
      ['a', [items[0], items[2]]],
    ]);
  });

  test('uses regex match as key when pattern matches', () => {
    getRegexMock.mockReturnValue(/^photo/);

    const items = [{ name: 'photo1.jpg' }, { name: 'photo2.png' }, { name: 'video.mp4' }];
    const result = buildGroupMap(items, 'photo', (item) => item.name, 'Other');

    expect(result).toEqual([
      ['Other', [items[2]]],
      ['photo', [items[0], items[1]]],
    ]);
  });

  test('places item under otherKey when regex does not match', () => {
    getRegexMock.mockReturnValue(/xyz/);

    const items = [{ name: 'alpha' }, { name: 'beta' }];
    const result = buildGroupMap(items, 'xyz', (item) => item.name, 'Other');

    expect(result).toEqual([['Other', items]]);
  });

  test('sorts groups alphabetically by key', () => {
    const items = [{ v: 'zebra' }, { v: 'alpha' }, { v: 'middle' }];
    const result = buildGroupMap(items, undefined, (item) => item.v, 'Other');
    const keys = result.map(([key]) => key);

    expect(keys).toEqual(['alpha', 'middle', 'zebra']);
  });

  test('otherKey participates in alphabetical sort', () => {
    const items = [{ v: 'zebra' }, { v: null }, { v: 'alpha' }];
    const result = buildGroupMap(items, undefined, (item) => item.v, 'Other');
    const keys = result.map(([key]) => key);

    // 'Other' sorts between 'alpha' and 'zebra'
    expect(keys[0]).toBe('Other');
    expect(keys).toContain('alpha');
    expect(keys).toContain('zebra');
  });

  test('preserves insertion order within a group', () => {
    const items = [
      { v: 'a', order: 1 },
      { v: 'b', order: 2 },
      { v: 'a', order: 3 },
    ];

    const result = buildGroupMap(items, undefined, (item) => item.v, 'Other');
    const [, aItems] = result.find(([key]) => key === 'a') ?? [];

    expect(aItems).toEqual([items[0], items[2]]);
  });

  test('returns sorted [key, items] tuple pairs', () => {
    const items = [{ v: 'b' }, { v: 'a' }];
    const result = buildGroupMap(items, undefined, (item) => item.v, 'Other');

    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toHaveLength(2);
    expect(result[0][0]).toBe('a');
    expect(Array.isArray(result[0][1])).toBe(true);
  });
});

describe('Test matchesFilter()', () => {
  test('matches value against exact pattern', () => {
    expect(matchesFilter('hello', 'hello', undefined)).toBe(true);
  });

  test('returns false when value differs from pattern', () => {
    expect(matchesFilter('hello', 'world', undefined)).toBe(false);
  });

  test('matches numeric value against identical number', () => {
    expect(matchesFilter(42, 42, undefined)).toBe(true);
  });

  test('returns false for type mismatch without regex', () => {
    expect(matchesFilter('42', 42, undefined)).toBe(false);
  });

  test('tests value against regex when provided', () => {
    expect(matchesFilter('hello world', undefined, /hello/)).toBe(true);
  });

  test('returns false when regex does not match', () => {
    expect(matchesFilter('goodbye', undefined, /hello/)).toBe(false);
  });

  test('coerces null value to empty string for regex test', () => {
    expect(matchesFilter(null, undefined, /^$/)).toBe(true);
  });

  test('coerces undefined value to empty string for regex test', () => {
    expect(matchesFilter(undefined, undefined, /^$/)).toBe(true);
  });
});

describe('Test sortItemsByKey()', () => {
  test('sorts strings ascending by default', () => {
    const items = [{ v: 'banana' }, { v: 'apple' }, { v: 'cherry' }];
    const result = sortItemsByKey(items, (i) => i.v, true, 'ascending');

    expect(result.map((i) => i.v)).toEqual(['apple', 'banana', 'cherry']);
  });

  test('sorts strings descending when order is descending', () => {
    const items = [{ v: 'banana' }, { v: 'apple' }, { v: 'cherry' }];
    const result = sortItemsByKey(items, (i) => i.v, true, 'descending');

    expect(result.map((i) => i.v)).toEqual(['cherry', 'banana', 'apple']);
  });

  test('sorts numbers ascending', () => {
    const items = [{ v: 30 }, { v: 10 }, { v: 20 }];
    const result = sortItemsByKey(items, (i) => i.v, false, 'ascending');

    expect(result.map((i) => i.v)).toEqual([10, 20, 30]);
  });

  test('sorts numbers descending', () => {
    const items = [{ v: 30 }, { v: 10 }, { v: 20 }];
    const result = sortItemsByKey(items, (i) => i.v, false, 'descending');

    expect(result.map((i) => i.v)).toEqual([30, 20, 10]);
  });

  test('mutates and returns the same array reference', () => {
    const items = [{ v: 'b' }, { v: 'a' }];
    const result = sortItemsByKey(items, (i) => i.v, true, 'ascending');

    expect(result).toBe(items);
  });

  test('computes the key once per item', () => {
    const items = [{ v: 3 }, { v: 1 }, { v: 2 }];
    const getKey = vi.fn((/** @type {{ v: number }} */ i) => i.v);

    sortItemsByKey(items, getKey, false, 'ascending');

    expect(getKey).toHaveBeenCalledTimes(3);
  });

  test('handles a list too large to spread into arguments', () => {
    // Spreading this many items into a function call exceeds the engine’s argument limit
    const items = Array.from({ length: 300000 }, (_, index) => ({ v: 300000 - index }));

    expect(() => sortItemsByKey(items, (i) => i.v, false, 'ascending')).not.toThrow();
    expect(items.length).toBe(300000);
    expect(items[0].v).toBe(1);
    expect(items.at(-1)?.v).toBe(300000);
  });

  test('leaves order unchanged when no order specified', () => {
    const items = [{ v: 'b' }, { v: 'a' }];

    sortItemsByKey(items, (i) => i.v, true, undefined);

    expect(items.map((i) => i.v)).toEqual(['a', 'b']);
  });

  test('computes each sort key once', () => {
    const items = [{ v: 'c' }, { v: 'a' }, { v: 'b' }];
    const getKey = vi.fn((i) => i.v);

    sortItemsByKey(items, getKey, true, 'ascending');

    expect(getKey).toHaveBeenCalledTimes(items.length);
    expect(items.map((i) => i.v)).toEqual(['a', 'b', 'c']);
  });
});

describe('Test initViewSettingsStorage()', () => {
  /**
   * Wait for the effects to run.
   * @returns {Promise<void>} Promise that resolves after a short delay.
   */
  const wait = () =>
    new Promise((resolve) => {
      setTimeout(resolve, 10);
    });

  beforeEach(() => {
    vi.clearAllMocks();
    mockDB.get.mockResolvedValue(undefined);
    mockDB.set.mockResolvedValue(undefined);
  });

  test('loads the settings from the database', async () => {
    /** @type {{ current: Record<string, any> | undefined }} */
    const settings = createRawState();

    mockDB.get.mockResolvedValue({ posts: { type: 'grid' } });

    await initViewSettingsStorage({ databaseName: 'test-db' }, 'contents-view', settings);

    expect(mockIndexedDB).toHaveBeenCalledWith('test-db', 'ui-settings');
    expect(mockDB.get).toHaveBeenCalledWith('contents-view');
    expect(settings.current).toEqual({ posts: { type: 'grid' } });
  });

  test('starts with empty settings without a database', async () => {
    /** @type {{ current: Record<string, any> | undefined }} */
    const settings = createRawState();

    await initViewSettingsStorage(undefined, 'contents-view', settings);

    expect(mockIndexedDB).not.toHaveBeenCalled();
    expect(settings.current).toEqual({});
  });

  test('persists a change to the settings', async () => {
    /** @type {{ current: Record<string, any> | undefined }} */
    const settings = createRawState();

    await initViewSettingsStorage({ databaseName: 'test-db' }, 'contents-view', settings);
    await wait();

    // The initial value is not written back
    expect(mockDB.set).not.toHaveBeenCalled();

    settings.current = { posts: { type: 'grid' } };
    await wait();

    expect(mockDB.set).toHaveBeenCalledWith('contents-view', { posts: { type: 'grid' } });

    // An equal value is not written again
    mockDB.set.mockClear();
    settings.current = { posts: { type: 'grid' } };
    await wait();

    expect(mockDB.set).not.toHaveBeenCalled();
  });

  test('ignores a database error', async () => {
    /** @type {{ current: Record<string, any> | undefined }} */
    const settings = createRawState();

    await initViewSettingsStorage({ databaseName: 'test-db' }, 'contents-view', settings);
    await wait();

    mockDB.set.mockRejectedValue(new Error('Storage error'));
    settings.current = { posts: { type: 'grid' } };
    await wait();

    expect(mockDB.set).toHaveBeenCalled();
    expect(settings.current).toEqual({ posts: { type: 'grid' } });
  });

  test('merges the saved settings into the defaults', async () => {
    /** @type {{ current: Record<string, any> | undefined }} */
    const settings = createRawState();

    mockDB.get.mockResolvedValue({ showPreview: false });

    await initViewSettingsStorage({ databaseName: 'test-db' }, 'entry-view', settings, {
      defaults: { showPreview: true, syncScrolling: true },
    });

    expect(settings.current).toEqual({ showPreview: false, syncScrolling: true });
  });

  test('stops persisting the settings with the returned function', async () => {
    /** @type {{ current: Record<string, any> | undefined }} */
    const settings = createRawState();

    const stop = await initViewSettingsStorage(
      { databaseName: 'test-db' },
      'contents-view',
      settings,
    );

    await wait();
    stop();

    settings.current = { posts: { type: 'grid' } };
    await wait();

    expect(mockDB.set).not.toHaveBeenCalled();
  });
});
