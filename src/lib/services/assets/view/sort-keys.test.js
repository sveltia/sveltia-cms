import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock the stores and dependencies
vi.mock('svelte-i18n', () => ({
  _: {
    subscribe: vi.fn(() => vi.fn()),
  },
  locale: {
    subscribe: vi.fn(() => vi.fn()),
  },
}));

vi.mock('$lib/services/assets', () => ({
  allAssets: {
    subscribe: vi.fn(() => vi.fn()),
  },
}));

describe('assets/view/sort-keys', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sortKeys', () => {
    it('should provide basic sort keys for assets without commit info', async () => {
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

      // Mock stores with proper subscribe behavior
      vi.doMock('svelte-i18n', () => ({
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

      vi.doMock('$lib/services/assets', () => ({
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
      // Force the derived store to update by subscribing
      let result;

      const unsubscribe = sortKeys.subscribe((value) => {
        result = value;
      });

      expect(result).toEqual([{ key: 'name', label: 'Name' }]);

      unsubscribe();
    });
  });
});
