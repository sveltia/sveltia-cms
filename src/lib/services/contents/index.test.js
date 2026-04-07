import { get } from 'svelte/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getCollection } from '$lib/services/contents/collection';

import {
  allEntries,
  allEntryFolders,
  dataLoaded,
  dataLoadedProgress,
  entryParseErrors,
  getEntryFoldersByPath,
} from '.';

vi.mock('$lib/services/contents/collection', () => ({
  getCollection: vi.fn(),
}));

describe('contents/index', () => {
  beforeEach(() => {
    // Reset stores before each test
    dataLoaded.set(false);
    dataLoadedProgress.set(undefined);
    allEntryFolders.set([]);
    allEntries.set([]);
    entryParseErrors.set([]);
    vi.clearAllMocks();
  });

  describe('store initialization', () => {
    it('should initialize dataLoaded as false', () => {
      expect(get(dataLoaded)).toBe(false);
    });

    it('should initialize dataLoadedProgress as undefined', () => {
      expect(get(dataLoadedProgress)).toBeUndefined();
    });

    it('should initialize allEntryFolders as empty array', () => {
      expect(get(allEntryFolders)).toEqual([]);
    });

    it('should initialize allEntries as empty array', () => {
      expect(get(allEntries)).toEqual([]);
    });

    it('should initialize entryParseErrors as empty array', () => {
      expect(get(entryParseErrors)).toEqual([]);
    });
  });

  describe('getEntryFoldersByPath', () => {
    it('should return empty array when no folders match', () => {
      allEntryFolders.set([
        /** @type {any} */ ({
          collectionName: 'posts',
          folderPath: 'content/posts',
          filePathMap: undefined,
        }),
      ]);

      const result = getEntryFoldersByPath('content/pages/about.md');

      expect(result).toEqual([]);
    });

    it('should return matching folders with filePathMap', () => {
      allEntryFolders.set([
        /** @type {any} */ ({
          collectionName: 'posts',
          folderPath: 'content/posts',
          filePathMap: {
            en: 'content/posts/en/post.md',
            fr: 'content/posts/fr/post.md',
          },
        }),
        /** @type {any} */ ({
          collectionName: 'pages',
          folderPath: 'content/pages',
          filePathMap: {
            en: 'content/pages/about.md',
          },
        }),
      ]);

      const result = getEntryFoldersByPath('content/posts/en/post.md');

      expect(result).toHaveLength(1);
      expect(result[0].collectionName).toBe('posts');
    });

    it('should return folders sorted by folderPath descending', () => {
      allEntryFolders.set([
        /** @type {any} */ ({
          collectionName: 'posts',
          folderPath: 'content/posts',
          filePathMap: {
            en: 'content/posts/test.md',
          },
        }),
        /** @type {any} */ ({
          collectionName: 'blog',
          folderPath: 'content/posts/blog',
          filePathMap: {
            en: 'content/posts/test.md',
          },
        }),
      ]);

      const result = getEntryFoldersByPath('content/posts/test.md');

      expect(result).toHaveLength(2);
      expect(result[0].collectionName).toBe('blog');
      expect(result[1].collectionName).toBe('posts');
    });

    it('should match using fullPathRegEx when filePathMap is not provided', () => {
      vi.mocked(getCollection).mockReturnValue(
        /** @type {any} */ ({
          _file: {
            fullPathRegEx: /^content\/posts\/.+\.md$/,
            extension: 'md',
            format: 'yaml-frontmatter',
          },
        }),
      );

      allEntryFolders.set([
        /** @type {any} */ ({
          collectionName: 'posts',
          folderPath: 'content/posts',
          filePathMap: undefined,
        }),
      ]);

      const result = getEntryFoldersByPath('content/posts/hello.md');

      expect(result).toHaveLength(1);
      expect(result[0].collectionName).toBe('posts');
    });

    it('should return empty array when fullPathRegEx does not match', () => {
      vi.mocked(getCollection).mockReturnValue(
        /** @type {any} */ ({
          _file: {
            fullPathRegEx: /^content\/posts\/.+\.md$/,
            extension: 'md',
            format: 'yaml-frontmatter',
          },
        }),
      );

      allEntryFolders.set([
        /** @type {any} */ ({
          collectionName: 'posts',
          folderPath: 'content/posts',
          filePathMap: undefined,
        }),
      ]);

      const result = getEntryFoldersByPath('content/pages/about.md');

      expect(result).toEqual([]);
    });

    it('should handle folder without folderPath', () => {
      allEntryFolders.set([
        /** @type {any} */ ({
          collectionName: 'posts',
          folderPath: undefined,
          filePathMap: {
            en: 'content/posts/test.md',
          },
        }),
      ]);

      const result = getEntryFoldersByPath('content/posts/test.md');

      expect(result).toHaveLength(1);
    });

    it('should sort correctly when some folders have undefined folderPath', () => {
      allEntryFolders.set([
        /** @type {any} */ ({
          collectionName: 'posts',
          folderPath: undefined,
          filePathMap: { en: 'content/posts/test.md' },
        }),
        /** @type {any} */ ({
          collectionName: 'blog',
          folderPath: 'content/posts/blog',
          filePathMap: { en: 'content/posts/test.md' },
        }),
      ]);

      const result = getEntryFoldersByPath('content/posts/test.md');

      expect(result).toHaveLength(2);
      // Folder with a defined folderPath sorts higher than one with undefined (empty string
      // fallback).
      expect(result[0].collectionName).toBe('blog');
      expect(result[1].collectionName).toBe('posts');
    });

    it('should sort stably when multiple folders have undefined folderPath', () => {
      allEntryFolders.set([
        /** @type {any} */ ({
          collectionName: 'alpha',
          folderPath: undefined,
          filePathMap: { en: 'content/shared.md' },
        }),
        /** @type {any} */ ({
          collectionName: 'beta',
          folderPath: undefined,
          filePathMap: { en: 'content/shared.md' },
        }),
      ]);

      const result = getEntryFoldersByPath('content/shared.md');

      // Both folders match; both folderPaths are undefined so the ?? '' fallback is hit on
      // both sides of the comparator in the same sort call.
      expect(result).toHaveLength(2);
    });

    it('should handle collection without _file property', () => {
      vi.mocked(getCollection).mockReturnValue(undefined);

      allEntryFolders.set([
        /** @type {any} */ ({
          collectionName: 'posts',
          folderPath: 'content/posts',
          filePathMap: undefined,
        }),
      ]);

      const result = getEntryFoldersByPath('content/posts/hello.md');

      expect(result).toEqual([]);
    });

    it('should handle multiple matches from filePathMap', () => {
      allEntryFolders.set([
        /** @type {any} */ ({
          collectionName: 'posts',
          folderPath: 'content/posts',
          filePathMap: {
            en: 'content/posts/test.md',
            fr: 'content/posts/test.md',
          },
        }),
      ]);

      const result = getEntryFoldersByPath('content/posts/test.md');

      expect(result).toHaveLength(1);
      expect(result[0].collectionName).toBe('posts');
    });

    it('should handle empty allEntryFolders', () => {
      allEntryFolders.set([]);

      const result = getEntryFoldersByPath('content/posts/test.md');

      expect(result).toEqual([]);
    });

    it('should reuse cache when allEntryFolders has not changed', () => {
      allEntryFolders.set([
        /** @type {any} */ ({
          collectionName: 'posts',
          folderPath: 'content/posts',
          filePathMap: { en: 'content/posts/test.md' },
        }),
      ]);

      // First call populates the cache.
      const result1 = getEntryFoldersByPath('content/posts/test.md');
      // Second call with the same store reference should hit the cache.
      const result2 = getEntryFoldersByPath('content/posts/test.md');

      expect(result1).toHaveLength(1);
      expect(result2).toHaveLength(1);
      expect(result1[0].collectionName).toBe('posts');
      expect(result2[0].collectionName).toBe('posts');
    });
  });
});
