import { beforeEach, describe, expect, it, vi } from 'vitest';

import { allAssets } from '$lib/services/assets';

import { sortKeys } from './sort-keys.js';

// Mock translation function
const mockTranslation = vi.hoisted(() =>
  vi.fn((/** @type {string} */ key) => {
    /** @type {Record<string, string>} */
    const translations = {
      'sort_keys.name': 'Name',
      'sort_keys.commit_author': 'Author',
      'sort_keys.commit_date': 'Date',
    };

    return translations[key] || key;
  }),
);

// Mock the state and dependencies
vi.mock('@sveltia/i18n', () => ({
  _: mockTranslation,
  locale: { current: 'en', set: vi.fn() },
}));

vi.mock('$lib/services/assets', () => ({
  allAssets: { current: [] },
}));

describe('assets/view/sort-keys', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    allAssets.current = /** @type {any} */ ([
      { name: 'image1.jpg', commitAuthor: null, commitDate: null },
      { name: 'image2.png', commitAuthor: null, commitDate: null },
    ]);
  });

  it('should export sortKeys state', () => {
    expect(sortKeys).toBeDefined();
    expect('current' in sortKeys).toBe(true);
  });

  it('should provide basic sort keys for assets without commit info', () => {
    expect(sortKeys.current).toEqual([{ key: 'name', label: 'Name' }]);
  });

  it('should include commit fields when all assets have commit info', () => {
    allAssets.current = /** @type {any} */ ([
      { name: 'image1.jpg', commitAuthor: 'Alice', commitDate: '2024-01-01' },
      { name: 'image2.png', commitAuthor: 'Bob', commitDate: '2024-01-02' },
    ]);

    expect(sortKeys.current).toEqual([
      { key: 'name', label: 'Name' },
      { key: 'commit_author', label: 'Author' },
      { key: 'commit_date', label: 'Date' },
    ]);
  });

  it('should not include commit fields when assets have inconsistent commit info', () => {
    allAssets.current = /** @type {any} */ ([
      { name: 'image1.jpg', commitAuthor: 'Alice', commitDate: '2024-01-01' },
      { name: 'image2.png', commitAuthor: null, commitDate: null },
    ]);

    expect(sortKeys.current).toEqual([{ key: 'name', label: 'Name' }]);
  });

  it('should include every field when the assets list is empty', () => {
    allAssets.current = [];

    // `every()` is true for an empty list
    expect(sortKeys.current.map(({ key }) => key)).toEqual([
      'name',
      'commit_author',
      'commit_date',
    ]);
  });
});
