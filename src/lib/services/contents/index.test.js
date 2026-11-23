import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  allEntries,
  allEntryFolders,
  dataLoaded,
  dataLoadedProgress,
  entryParseErrors,
  findEntryByPaths,
} from '.';

vi.mock('$lib/services/contents/collection', () => ({
  getCollection: vi.fn(),
}));

describe('contents/index', () => {
  beforeEach(() => {
    // Reset stores before each test
    dataLoaded.current = false;
    dataLoadedProgress.current = undefined;
    allEntryFolders.current = [];
    allEntries.current = [];
    entryParseErrors.current = [];
    vi.clearAllMocks();
  });

  describe('store initialization', () => {
    it('should initialize dataLoaded as false', () => {
      expect(dataLoaded.current).toBe(false);
    });

    it('should initialize dataLoadedProgress as undefined', () => {
      expect(dataLoadedProgress.current).toBeUndefined();
    });

    it('should initialize allEntryFolders as empty array', () => {
      expect(allEntryFolders.current).toEqual([]);
    });

    it('should initialize allEntries as empty array', () => {
      expect(allEntries.current).toEqual([]);
    });

    it('should initialize entryParseErrors as empty array', () => {
      expect(entryParseErrors.current).toEqual([]);
    });
  });

  describe('findEntryByPaths()', () => {
    /**
     * Create an entry with a file per locale.
     * @param {string} id Entry ID.
     * @param {Record<string, string>} paths File path by locale.
     * @returns {any} Entry.
     */
    const createEntry = (id, paths) => ({
      id,
      locales: Object.fromEntries(
        Object.entries(paths).map(([locale, path]) => [locale, { path, content: {} }]),
      ),
    });

    it('should find the entry holding a file at any of the given paths', () => {
      const post = createEntry('post', { en: 'posts/en/a.md', ja: 'posts/ja/a.md' });

      allEntries.current = [createEntry('page', { en: 'pages/b.md' }), post];

      expect(findEntryByPaths(new Set(['missing.md', 'posts/ja/a.md']))).toBe(post);
      expect(findEntryByPaths(['missing.md'])).toBeUndefined();
    });

    it('should prefer the entry that comes first in the store', () => {
      const first = createEntry('first', { en: 'a.md', ja: 'shared.md' });
      const second = createEntry('second', { en: 'b.md', ja: 'shared.md' });

      allEntries.current = [first, second];

      // Found by its own path, but the other entry comes first
      expect(findEntryByPaths(['b.md', 'a.md'])).toBe(first);
      // Two entries share a path, and the first one wins
      expect(findEntryByPaths(['shared.md'])).toBe(first);
    });

    it('should index the store again once it is replaced', () => {
      allEntries.current = [createEntry('old', { en: 'a.md' })];
      expect(findEntryByPaths(['a.md'])?.id).toBe('old');

      allEntries.current = [createEntry('new', { en: 'a.md' })];
      expect(findEntryByPaths(['a.md'])?.id).toBe('new');
    });
  });
});
