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

  describe('sortKeys', () => {
    it('should provide basic sort keys for assets without commit info', () => {
      let result;

      const unsubscribe = sortKeys.subscribe((value) => {
        result = value;
      });

      expect(result).toEqual([{ key: 'name', label: 'Name' }]);

      unsubscribe();
    });
  });
});
