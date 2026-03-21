import { beforeEach, describe, expect, test, vi } from 'vitest';

import { buildGroupMap } from './view';

vi.mock('@sveltia/utils/string', () => ({
  compare: vi.fn((a, b) => {
    if (String(a) < String(b)) return -1;
    if (String(a) > String(b)) return 1;
    return 0;
  }),
}));

vi.mock('$lib/services/utils/misc', () => ({
  getRegex: vi.fn(),
}));

describe('Test buildGroupMap()', () => {
  /** @type {import('vitest').MockedFunction<any>} */
  let getRegexMock;

  beforeEach(async () => {
    vi.clearAllMocks();

    const { getRegex } = await import('$lib/services/utils/misc');

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
