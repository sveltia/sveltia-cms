/* eslint-disable jsdoc/require-returns */
// @ts-nocheck

import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('svelte/store', () => ({
  get: vi.fn(),
  writable: vi.fn(() => ({ subscribe: vi.fn() })),
}));

vi.mock('$lib/services/backends', () => ({
  backend: { subscribe: vi.fn() },
}));

describe('history', () => {
  /** @type {typeof import('svelte/store').get} */
  let mockGet;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    mockGet = (await import('svelte/store')).get;
  });

  /**
   * Import the module fresh for each test to reset the module-level cache.
   */
  const importModule = async () => import('$lib/services/contents/entry/history');

  describe('fetchEntryHistory()', () => {
    test('returns cached result on subsequent calls for the same entry', async () => {
      const commits = [{ sha: 'abc', authorName: 'Alice', date: '2025-01-01T00:00:00Z' }];
      const fetchFileCommits = vi.fn().mockResolvedValue(commits);
      const entry = { id: 'entry-1', locales: { _default: { path: 'content/posts/hello.md' } } };

      mockGet.mockReturnValue({ fetchFileCommits });

      const { fetchEntryHistory } = await importModule();
      const result1 = await fetchEntryHistory(entry);

      expect(result1.commits).toEqual(commits);
      expect(fetchFileCommits).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result2 = await fetchEntryHistory(entry);

      expect(result2).toBe(result1);
      expect(fetchFileCommits).toHaveBeenCalledTimes(1);
    });

    test('returns empty result when backend has no fetchFileCommits', async () => {
      const entry = { id: 'entry-1', locales: { _default: { path: 'content/posts/hello.md' } } };

      mockGet.mockReturnValue({});

      const { fetchEntryHistory } = await importModule();
      const result = await fetchEntryHistory(entry);

      expect(result).toEqual({ commits: [], loading: false, error: false });
    });

    test('fetches and caches commits successfully', async () => {
      const commits = [
        { sha: 'aaa', authorName: 'Alice', date: '2025-01-01' },
        { sha: 'bbb', authorName: 'Bob', date: '2025-01-02' },
      ];

      const fetchFileCommits = vi.fn().mockResolvedValue(commits);

      const entry = {
        id: 'entry-2',
        locales: {
          en: { path: 'content/posts/en/hello.md' },
          fr: { path: 'content/posts/fr/hello.md' },
        },
      };

      mockGet.mockReturnValue({ fetchFileCommits });

      const { fetchEntryHistory } = await importModule();
      const result = await fetchEntryHistory(entry);

      expect(result).toEqual({ commits, loading: false, error: false });
      expect(fetchFileCommits).toHaveBeenCalledWith([
        'content/posts/en/hello.md',
        'content/posts/fr/hello.md',
      ]);
    });

    test('deduplicates paths for single_file i18n', async () => {
      const fetchFileCommits = vi.fn().mockResolvedValue([]);

      const entry = {
        id: 'entry-3',
        locales: {
          en: { path: 'content/posts/hello.md' },
          fr: { path: 'content/posts/hello.md' },
        },
      };

      mockGet.mockReturnValue({ fetchFileCommits });

      const { fetchEntryHistory } = await importModule();

      await fetchEntryHistory(entry);

      expect(fetchFileCommits).toHaveBeenCalledWith(['content/posts/hello.md']);
    });

    test('returns error result when fetchFileCommits throws', async () => {
      const fetchFileCommits = vi.fn().mockRejectedValue(new Error('API error'));
      const entry = { id: 'entry-4', locales: { _default: { path: 'content/posts/hello.md' } } };

      mockGet.mockReturnValue({ fetchFileCommits });

      const { fetchEntryHistory } = await importModule();
      const result = await fetchEntryHistory(entry);

      expect(result).toEqual({ commits: [], loading: false, error: true });
    });

    test('caches error result and returns it on subsequent calls', async () => {
      const fetchFileCommits = vi.fn().mockRejectedValue(new Error('API error'));
      const entry = { id: 'entry-5', locales: { _default: { path: 'content/posts/hello.md' } } };

      mockGet.mockReturnValue({ fetchFileCommits });

      const { fetchEntryHistory } = await importModule();
      const result1 = await fetchEntryHistory(entry);

      expect(result1.error).toBe(true);

      // Second call should return cached error
      const result2 = await fetchEntryHistory(entry);

      expect(result2).toBe(result1);
      expect(fetchFileCommits).toHaveBeenCalledTimes(1);
    });
  });

  describe('clearEntryHistoryCache()', () => {
    test('clears cache for the given entry', async () => {
      const commits = [{ sha: 'abc', authorName: 'Alice', date: '2025-01-01' }];
      const fetchFileCommits = vi.fn().mockResolvedValue(commits);
      const entry = { id: 'entry-6', locales: { _default: { path: 'content/posts/hello.md' } } };

      mockGet.mockReturnValue({ fetchFileCommits });

      const { fetchEntryHistory, clearEntryHistoryCache } = await importModule();

      await fetchEntryHistory(entry);

      expect(fetchFileCommits).toHaveBeenCalledTimes(1);

      // Clear cache
      clearEntryHistoryCache('entry-6');

      // Should fetch again
      await fetchEntryHistory(entry);

      expect(fetchFileCommits).toHaveBeenCalledTimes(2);
    });

    test('does not throw when entryId is not in cache', async () => {
      const { clearEntryHistoryCache } = await importModule();

      // Should not throw
      expect(() => clearEntryHistoryCache('nonexistent-entry')).not.toThrow();
    });

    test('retains cache for other entries after clearing one', async () => {
      const commits1 = [{ sha: 'aaa', authorName: 'Alice', date: '2025-01-01' }];
      const commits2 = [{ sha: 'bbb', authorName: 'Bob', date: '2025-01-02' }];
      const fetchFileCommits = vi.fn();
      const backendObj = { fetchFileCommits };
      const entry1 = { id: 'entry-a', locales: { _default: { path: 'content/posts/a.md' } } };
      const entry2 = { id: 'entry-b', locales: { _default: { path: 'content/posts/b.md' } } };

      mockGet.mockReturnValue(backendObj);

      const { fetchEntryHistory, clearEntryHistoryCache } = await importModule();

      // Fetch entry A
      fetchFileCommits.mockResolvedValue(commits1);

      const resultA = await fetchEntryHistory(entry1);

      expect(resultA.commits).toEqual(commits1);

      // Fetch entry B
      fetchFileCommits.mockResolvedValue(commits2);

      const resultB = await fetchEntryHistory(entry2);

      expect(resultB.commits).toEqual(commits2);
      expect(fetchFileCommits).toHaveBeenCalledTimes(2);

      // Clear cache for entry B only
      clearEntryHistoryCache('entry-b');

      // Entry A should still be cached
      const resultA2 = await fetchEntryHistory(entry1);

      expect(resultA2).toBe(resultA);
      expect(fetchFileCommits).toHaveBeenCalledTimes(2); // No additional fetch
    });
  });
});
