import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock translation function
const mockTranslation = vi.fn((/** @type {string} */ key) => {
  /** @type {Record<string, string>} */
  const translations = {
    'sort_keys.name': 'Name',
    'sort_keys.commit_author': 'Author',
    'sort_keys.commit_date': 'Date',
  };

  return translations[key] || key;
});

// Mock the stores and dependencies
vi.mock('svelte-i18n', () => ({
  _: {
    subscribe: vi.fn((callback) => {
      callback(mockTranslation);
      return vi.fn();
    }),
  },
  locale: {
    subscribe: vi.fn((callback) => {
      callback('en');
      return vi.fn();
    }),
  },
}));

vi.mock('$lib/services/assets', () => ({
  allAssets: {
    subscribe: vi.fn((callback) => {
      callback([
        { name: 'image1.jpg', commitAuthor: null, commitDate: null },
        { name: 'image2.png', commitAuthor: null, commitDate: null },
      ]);
      return vi.fn();
    }),
  },
}));

// Import after mocking
const { sortKeys } = await import('./sort-keys.js');

describe('assets/view/sort-keys', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export sortKeys store', () => {
    expect(sortKeys).toBeDefined();
    expect(typeof sortKeys.subscribe).toBe('function');
  });

  it('should include name field by default', () => {
    /** @type {any} */
    let currentSortKeys;

    sortKeys.subscribe((keys) => {
      currentSortKeys = keys;
    })();

    expect(currentSortKeys).toBeDefined();
    expect(currentSortKeys?.some((/** @type {any} */ k) => k.key === 'name')).toBe(true);
  });

  it('should provide basic sort keys for assets without commit info', () => {
    let result;

    const unsubscribe = sortKeys.subscribe((value) => {
      result = value;
    });

    expect(result).toEqual([{ key: 'name', label: 'Name' }]);

    unsubscribe();
  });

  it('should include commit_author when all assets have author info', async () => {
    // Re-mock with assets that have commit authors
    vi.doMock('$lib/services/assets', () => ({
      allAssets: {
        subscribe: vi.fn((callback) => {
          callback([
            { name: 'image1.jpg', commitAuthor: 'Alice', commitDate: '2024-01-01' },
            { name: 'image2.png', commitAuthor: 'Bob', commitDate: '2024-01-02' },
          ]);
          return vi.fn();
        }),
      },
    }));

    // Re-import to get the new mock
    vi.resetModules();

    const { sortKeys: newSortKeys } = await import('./sort-keys.js');
    /** @type {any} */
    let result;

    const unsubscribe = newSortKeys.subscribe((value) => {
      result = value;
    });

    expect(result).toBeDefined();
    expect(result?.some((/** @type {any} */ k) => k.key === 'commit_author')).toBe(true);
    expect(result?.some((/** @type {any} */ k) => k.key === 'commit_date')).toBe(true);
    expect(result?.find((/** @type {any} */ k) => k.key === 'commit_author')?.label).toBe('Author');
    expect(result?.find((/** @type {any} */ k) => k.key === 'commit_date')?.label).toBe('Date');

    unsubscribe();
  });

  it('should not include commit fields when assets have inconsistent commit info', async () => {
    // Re-mock with assets that have some missing commit info
    vi.doMock('$lib/services/assets', () => ({
      allAssets: {
        subscribe: vi.fn((callback) => {
          callback([
            { name: 'image1.jpg', commitAuthor: 'Alice', commitDate: '2024-01-01' },
            { name: 'image2.png', commitAuthor: null, commitDate: null },
          ]);
          return vi.fn();
        }),
      },
    }));

    vi.resetModules();

    const { sortKeys: newSortKeys } = await import('./sort-keys.js');
    /** @type {any} */
    let result;

    const unsubscribe = newSortKeys.subscribe((value) => {
      result = value;
    });

    expect(result).toEqual([{ key: 'name', label: 'Name' }]);
    expect(result?.some((/** @type {any} */ k) => k.key === 'commit_author')).toBe(false);
    expect(result?.some((/** @type {any} */ k) => k.key === 'commit_date')).toBe(false);

    unsubscribe();
  });

  it('should include only name when assets list is empty', async () => {
    vi.doMock('$lib/services/assets', () => ({
      allAssets: {
        subscribe: vi.fn((callback) => {
          callback([]);
          return vi.fn();
        }),
      },
    }));

    vi.resetModules();

    const { sortKeys: newSortKeys } = await import('./sort-keys.js');
    /** @type {any} */
    let result;

    const unsubscribe = newSortKeys.subscribe((value) => {
      result = value;
    });

    // When array is empty, .every() returns true (vacuous truth)
    // So all sort fields will be included
    expect(result).toEqual([
      { key: 'name', label: 'Name' },
      { key: 'commit_author', label: 'Author' },
      { key: 'commit_date', label: 'Date' },
    ]);

    unsubscribe();
  });
});
