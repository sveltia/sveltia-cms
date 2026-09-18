// @vitest-environment happy-dom

import { beforeEach, describe, expect, test, vi } from 'vitest';

import { createRawState } from '$lib/services/utils/state.svelte';

import {
  buildGroupMap,
  COMPARISON_OPERATORS,
  getCollapsibleGroupNames,
  getConditionKey,
  getGroupingKey,
  getGroupLabel,
  getViewConditions,
  hasComparison,
  initViewSettingsStorage,
  isGroupCollapsed,
  matchesFilter,
  OTHER_GROUP_NAME,
  setAllGroupsCollapsed,
  setGroupCollapsed,
  sortItemsByKey,
} from './view';

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

vi.mock('@sveltia/i18n', () => ({
  _: vi.fn((/** @type {string} */ key) => (key === 'other' ? 'Other' : key)),
}));

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
    const result = buildGroupMap([], undefined, (item) => item);

    expect(result).toEqual([]);
  });

  test('groups items by exact string value', () => {
    const items = [
      { id: 1, category: 'a' },
      { id: 2, category: 'b' },
      { id: 3, category: 'a' },
    ];

    const result = buildGroupMap(items, undefined, (item) => item.category);

    expect(result).toEqual([
      ['a', [items[0], items[2]]],
      ['b', [items[1]]],
    ]);
  });

  test('groups items by numeric value (coerced to string)', () => {
    const items = [{ v: 1 }, { v: 2 }, { v: 1 }];
    const result = buildGroupMap(items, undefined, (item) => item.v);

    expect(result).toEqual([
      ['1', [items[0], items[2]]],
      ['2', [items[1]]],
    ]);
  });

  test('places items with null value under the Other group', () => {
    const items = [{ v: 'a' }, { v: null }, { v: 'a' }];
    const result = buildGroupMap(items, undefined, (item) => item.v);

    expect(result).toEqual([
      [OTHER_GROUP_NAME, [items[1]]],
      ['a', [items[0], items[2]]],
    ]);
  });

  test('places items with undefined value under the Other group', () => {
    const items = [{ v: 'a' }, {}, { v: 'a' }];
    const result = buildGroupMap(items, undefined, (item) => /** @type {any} */ (item).v);

    expect(result).toEqual([
      [OTHER_GROUP_NAME, [items[1]]],
      ['a', [items[0], items[2]]],
    ]);
  });

  test('uses regex match as key when pattern matches', () => {
    getRegexMock.mockReturnValue(/^photo/);

    const items = [{ name: 'photo1.jpg' }, { name: 'photo2.png' }, { name: 'video.mp4' }];
    const result = buildGroupMap(items, 'photo', (item) => item.name);

    expect(result).toEqual([
      [OTHER_GROUP_NAME, [items[2]]],
      ['photo', [items[0], items[1]]],
    ]);
  });

  test('places item under the Other group when regex does not match', () => {
    getRegexMock.mockReturnValue(/xyz/);

    const items = [{ name: 'alpha' }, { name: 'beta' }];
    const result = buildGroupMap(items, 'xyz', (item) => item.name);

    expect(result).toEqual([[OTHER_GROUP_NAME, items]]);
  });

  test('sorts groups alphabetically by key', () => {
    const items = [{ v: 'zebra' }, { v: 'alpha' }, { v: 'middle' }];
    const result = buildGroupMap(items, undefined, (item) => item.v);
    const keys = result.map(([key]) => key);

    expect(keys).toEqual(['alpha', 'middle', 'zebra']);
  });

  test('sorts the Other group by its localized label, not its name', () => {
    const items = [{ v: 'Zebra' }, { v: null }, { v: 'Alpha' }];
    const result = buildGroupMap(items, undefined, (item) => item.v);

    // “Other” sorts between “Alpha” and “Zebra”, where `*other` would come first
    expect(result.map(([key]) => key)).toEqual(['Alpha', OTHER_GROUP_NAME, 'Zebra']);
  });

  test('preserves insertion order within a group', () => {
    const items = [
      { v: 'a', order: 1 },
      { v: 'b', order: 2 },
      { v: 'a', order: 3 },
    ];

    const result = buildGroupMap(items, undefined, (item) => item.v);
    const [, aItems] = result.find(([key]) => key === 'a') ?? [];

    expect(aItems).toEqual([items[0], items[2]]);
  });

  test('returns sorted [key, items] tuple pairs', () => {
    const items = [{ v: 'b' }, { v: 'a' }];
    const result = buildGroupMap(items, undefined, (item) => item.v);

    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toHaveLength(2);
    expect(result[0][0]).toBe('a');
    expect(Array.isArray(result[0][1])).toBe(true);
  });
});

describe('Test getGroupLabel()', () => {
  test('localizes the Other group and leaves the rest alone', () => {
    expect(getGroupLabel(OTHER_GROUP_NAME)).toBe('Other');
    expect(getGroupLabel('news')).toBe('news');
    expect(getGroupLabel('*')).toBe('*');
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

describe('Test getCollapsibleGroupNames()', () => {
  test('leaves out the ungrouped `*` group', () => {
    expect(getCollapsibleGroupNames(['*'])).toEqual([]);
    expect(getCollapsibleGroupNames(['blog', 'news'])).toEqual(['blog', 'news']);
    expect(getCollapsibleGroupNames([])).toEqual([]);
  });
});

describe('Test getViewConditions()', () => {
  test('keeps the field and pattern, leaving out the name and label', () => {
    expect(
      getViewConditions({ name: 'year', label: 'Year', field: 'date', pattern: '\\d{4}' }),
    ).toEqual({ field: 'date', pattern: '\\d{4}' });
    expect(getViewConditions({ label: 'Draft', field: 'draft', pattern: true })).toEqual({
      field: 'draft',
      pattern: true,
    });
  });

  test('leaves out an undefined pattern', () => {
    expect(getViewConditions({ label: 'Category', field: 'category' })).toEqual({
      field: 'category',
    });
    expect(getViewConditions({ label: 'Category', field: 'category', pattern: undefined })).toEqual(
      { field: 'category' },
    );
  });

  test('keeps every comparison operator that is defined', () => {
    expect(
      getViewConditions({
        label: 'Upcoming',
        field: 'date',
        gte: '{{today}}',
        in: ['a', 'b'],
        not_in: [],
        eq: false,
        lt: 0,
        gt: undefined,
      }),
    ).toEqual({ field: 'date', gte: '{{today}}', in: ['a', 'b'], not_in: [], eq: false, lt: 0 });
  });
});

describe('Test hasComparison()', () => {
  test('detects a comparison operator', () => {
    expect(hasComparison(undefined)).toBe(false);
    expect(hasComparison(null)).toBe(false);
    expect(hasComparison({ field: 'date' })).toBe(false);
    expect(hasComparison({ field: 'date', pattern: '\\d{4}' })).toBe(false);
    expect(hasComparison({ field: 'date', gte: undefined })).toBe(false);

    COMPARISON_OPERATORS.forEach((operator) => {
      expect(hasComparison({ field: 'date', [operator]: '2024' })).toBe(true);
    });
  });
});

describe('Test getConditionKey()', () => {
  test('writes the field and the string form of the pattern', () => {
    expect(getConditionKey({ field: 'category' })).toBe('["category"]');
    expect(getConditionKey({ field: 'category', pattern: undefined })).toBe('["category"]');
    expect(getConditionKey({ field: 'date', pattern: '\\d{4}' })).toBe('["date","\\\\d{4}"]');
    expect(getConditionKey({ field: 'date', pattern: /\d{4}/ })).toBe('["date","/\\\\d{4}/"]');
    expect(getConditionKey({ field: 'draft', pattern: true })).toBe('["draft","true"]');
  });

  test('writes the comparison operators in a fixed order after the pattern', () => {
    expect(getConditionKey({ field: 'date', gte: '{{today}}' })).toBe(
      '["date",null,{"gte":"{{today}}"}]',
    );
    expect(getConditionKey({ field: 'date', pattern: '^2024', lt: '{{now}}' })).toBe(
      '["date","^2024",{"lt":"{{now}}"}]',
    );
    expect(getConditionKey({ field: 'n', in: [1, 2], eq: 3 })).toBe(
      getConditionKey({ field: 'n', eq: 3, in: [1, 2] }),
    );
    expect(getConditionKey({ field: 'n', in: [1, 2], eq: 3 })).toBe(
      '["n",null,{"eq":3,"in":[1,2]}]',
    );
  });

  test('tells conditions apart', () => {
    const keys = [
      { field: 'date' },
      { field: 'date', pattern: '\\d{4}' },
      { field: 'date', gte: '{{today}}' },
      { field: 'date', gt: '{{today}}' },
      { field: 'date', lt: '{{today}}' },
      { field: 'date', pattern: '\\d{4}', gte: '{{today}}' },
      { field: 'time', gte: '{{today}}' },
    ].map(getConditionKey);

    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('Test getGroupingKey()', () => {
  test('keys a condition by its field and pattern', () => {
    expect(getGroupingKey(undefined)).toBeUndefined();
    expect(getGroupingKey(null)).toBeUndefined();
    expect(getGroupingKey({ field: 'category' })).toBe('["category"]');
    expect(getGroupingKey({ field: 'date', pattern: '\\d{4}' })).toBe('["date","\\\\d{4}"]');
    expect(getGroupingKey({ field: 'draft', pattern: true })).toBe('["draft","true"]');
    // A pattern can hold any character without making the key ambiguous
    expect(getGroupingKey({ field: 'tag', pattern: 'a|b' })).toBe('["tag","a|b"]');
    expect(getGroupingKey({ field: 'date', gte: '{{today}}' })).toBe(
      '["date",null,{"gte":"{{today}}"}]',
    );
  });
});

describe('Test isGroupCollapsed()', () => {
  test('reads the collapsed groups of the current grouping condition', () => {
    const collapsedGroups = { '["category"]': ['news'], '["date","\\\\d{4}"]': ['2010'] };

    expect(isGroupCollapsed({ type: 'list' }, 'news')).toBe(false);
    expect(isGroupCollapsed({ group: { field: 'category' } }, 'news')).toBe(false);
    expect(isGroupCollapsed({ group: { field: 'category' }, collapsedGroups }, 'news')).toBe(true);
    expect(isGroupCollapsed({ group: { field: 'category' }, collapsedGroups }, 'blog')).toBe(false);
    expect(isGroupCollapsed({ group: { field: 'category' }, collapsedGroups }, '2010')).toBe(false);
    expect(
      isGroupCollapsed({ group: { field: 'date', pattern: '\\d{4}' }, collapsedGroups }, '2010'),
    ).toBe(true);
    // Nothing is collapsed without grouping, whatever is saved
    expect(isGroupCollapsed({ group: null, collapsedGroups }, 'news')).toBe(false);
  });
});

describe('Test setGroupCollapsed()', () => {
  const group = { field: 'category' };

  test('collapses a group, once, under the current grouping condition', () => {
    const view = {
      type: 'list',
      group,
      collapsedGroups: { '["category"]': ['news'], '["year"]': ['2010'] },
    };

    expect(setGroupCollapsed(view, 'blog', true)).toEqual({
      type: 'list',
      group,
      collapsedGroups: { '["category"]': ['news', 'blog'], '["year"]': ['2010'] },
    });
    expect(setGroupCollapsed(view, 'news', true)).toEqual(view);
    expect(setGroupCollapsed({ type: 'list', group }, 'news', true)).toEqual({
      type: 'list',
      group,
      collapsedGroups: { '["category"]': ['news'] },
    });
    // The given view is left alone
    expect(view).toEqual({
      type: 'list',
      group,
      collapsedGroups: { '["category"]': ['news'], '["year"]': ['2010'] },
    });
  });

  test('expands a group, dropping the saved state that is left empty', () => {
    expect(
      setGroupCollapsed(
        { group, collapsedGroups: { '["category"]': ['news', 'blog'] } },
        'news',
        false,
      ),
    ).toEqual({ group, collapsedGroups: { '["category"]': ['blog'] } });
    expect(
      setGroupCollapsed(
        { group, collapsedGroups: { '["category"]': ['news'], '["year"]': ['2010'] } },
        'news',
        false,
      ),
    ).toEqual({ group, collapsedGroups: { '["year"]': ['2010'] } });
    expect(
      setGroupCollapsed(
        { type: 'grid', group, collapsedGroups: { '["category"]': ['news'] } },
        'news',
        false,
      ),
    ).toEqual({ type: 'grid', group });
    expect(setGroupCollapsed({ type: 'grid', group }, 'news', false)).toEqual({
      type: 'grid',
      group,
    });
  });

  test('does nothing without grouping', () => {
    const view = { type: 'list', group: null, collapsedGroups: { '["category"]': ['news'] } };

    expect(setGroupCollapsed(view, 'news', true)).toBe(view);
    expect(setGroupCollapsed({ type: 'list' }, 'news', false)).toEqual({ type: 'list' });
  });
});

describe('Test setAllGroupsCollapsed()', () => {
  const group = { field: 'category' };

  test('collapses all the given groups under the current grouping condition', () => {
    const names = ['blog', 'news'];

    const view = setAllGroupsCollapsed(
      { type: 'list', group, collapsedGroups: { '["category"]': ['old'], '["year"]': ['2010'] } },
      names,
      true,
    );

    expect(view).toEqual({
      type: 'list',
      group,
      collapsedGroups: { '["category"]': ['blog', 'news'], '["year"]': ['2010'] },
    });
    // The names are copied, so the view is not changed with the list
    expect(view.collapsedGroups?.['["category"]']).not.toBe(names);
  });

  test('expands all the groups, forgetting the ones no longer listed', () => {
    expect(
      setAllGroupsCollapsed(
        {
          type: 'list',
          group,
          collapsedGroups: { '["category"]': ['old', 'blog'], '["year"]': ['2010'] },
        },
        ['blog'],
        false,
      ),
    ).toEqual({ type: 'list', group, collapsedGroups: { '["year"]': ['2010'] } });
    expect(
      setAllGroupsCollapsed(
        { type: 'list', group, collapsedGroups: { '["category"]': ['old', 'blog'] } },
        ['blog'],
        false,
      ),
    ).toEqual({ type: 'list', group });
  });

  test('does nothing without grouping', () => {
    const view = { type: 'list' };

    expect(setAllGroupsCollapsed(view, ['blog'], true)).toBe(view);
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
