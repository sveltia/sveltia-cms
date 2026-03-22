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

vi.mock('$lib/services/contents/draft', () => ({
  entryDraft: { subscribe: vi.fn() },
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
    test('returns empty result when there is no entry draft', async () => {
      mockGet.mockReturnValue(undefined);

      const { fetchEntryHistory } = await importModule();
      const result = await fetchEntryHistory();

      expect(result).toEqual({ commits: [], loading: false, error: false });
    });

    test('returns empty result when draft has no originalEntry', async () => {
      mockGet.mockReturnValue({ id: 'x', originalEntry: undefined });

      const { fetchEntryHistory } = await importModule();
      const result = await fetchEntryHistory();

      expect(result).toEqual({ commits: [], loading: false, error: false });
    });

    test('returns cached result on subsequent calls for the same entry', async () => {
      const commits = [{ sha: 'abc', authorName: 'Alice', date: '2025-01-01T00:00:00Z' }];
      const fetchFileCommits = vi.fn().mockResolvedValue(commits);

      const draft = {
        id: 'entry-1',
        originalEntry: {
          id: 'entry-1',
          locales: { _default: { path: 'content/posts/hello.md' } },
        },
      };

      let callCount = 0;

      mockGet.mockImplementation(() => {
        callCount += 1;

        return callCount % 2 === 1 ? draft : { fetchFileCommits };
      });

      const { fetchEntryHistory } = await importModule();
      const result1 = await fetchEntryHistory();

      expect(result1.commits).toEqual(commits);
      expect(fetchFileCommits).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result2 = await fetchEntryHistory();

      expect(result2).toBe(result1);
      expect(fetchFileCommits).toHaveBeenCalledTimes(1);
    });

    test('returns empty result when backend has no fetchFileCommits', async () => {
      const draft = {
        id: 'entry-1',
        originalEntry: {
          id: 'entry-1',
          locales: { _default: { path: 'content/posts/hello.md' } },
        },
      };

      let callCount = 0;

      mockGet.mockImplementation(() => {
        callCount += 1;

        // First call: entryDraft, second call: backend
        return callCount === 1 ? draft : {};
      });

      const { fetchEntryHistory } = await importModule();
      const result = await fetchEntryHistory();

      expect(result).toEqual({ commits: [], loading: false, error: false });
    });

    test('fetches and caches commits successfully', async () => {
      const commits = [
        { sha: 'aaa', authorName: 'Alice', date: '2025-01-01' },
        { sha: 'bbb', authorName: 'Bob', date: '2025-01-02' },
      ];

      const fetchFileCommits = vi.fn().mockResolvedValue(commits);

      const draft = {
        id: 'entry-2',
        originalEntry: {
          id: 'entry-2',
          locales: {
            en: { path: 'content/posts/en/hello.md' },
            fr: { path: 'content/posts/fr/hello.md' },
          },
        },
      };

      let callCount = 0;

      mockGet.mockImplementation(() => {
        callCount += 1;

        return callCount === 1 ? draft : { fetchFileCommits };
      });

      const { fetchEntryHistory } = await importModule();
      const result = await fetchEntryHistory();

      expect(result).toEqual({ commits, loading: false, error: false });
      expect(fetchFileCommits).toHaveBeenCalledWith([
        'content/posts/en/hello.md',
        'content/posts/fr/hello.md',
      ]);
    });

    test('deduplicates paths for single_file i18n', async () => {
      const fetchFileCommits = vi.fn().mockResolvedValue([]);

      const draft = {
        id: 'entry-3',
        originalEntry: {
          id: 'entry-3',
          locales: {
            en: { path: 'content/posts/hello.md' },
            fr: { path: 'content/posts/hello.md' },
          },
        },
      };

      let callCount = 0;

      mockGet.mockImplementation(() => {
        callCount += 1;

        return callCount === 1 ? draft : { fetchFileCommits };
      });

      const { fetchEntryHistory } = await importModule();

      await fetchEntryHistory();

      expect(fetchFileCommits).toHaveBeenCalledWith(['content/posts/hello.md']);
    });

    test('returns error result when fetchFileCommits throws', async () => {
      const fetchFileCommits = vi.fn().mockRejectedValue(new Error('API error'));

      const draft = {
        id: 'entry-4',
        originalEntry: {
          id: 'entry-4',
          locales: { _default: { path: 'content/posts/hello.md' } },
        },
      };

      let callCount = 0;

      mockGet.mockImplementation(() => {
        callCount += 1;

        return callCount === 1 ? draft : { fetchFileCommits };
      });

      const { fetchEntryHistory } = await importModule();
      const result = await fetchEntryHistory();

      expect(result).toEqual({ commits: [], loading: false, error: true });
    });

    test('caches error result and returns it on subsequent calls', async () => {
      const fetchFileCommits = vi.fn().mockRejectedValue(new Error('API error'));

      const draft = {
        id: 'entry-5',
        originalEntry: {
          id: 'entry-5',
          locales: { _default: { path: 'content/posts/hello.md' } },
        },
      };

      // Always return the same draft/backend
      mockGet.mockImplementation(() => draft);

      // Need a different approach since get() is called for both stores
      let callCount = 0;

      mockGet.mockImplementation(() => {
        callCount += 1;

        if (callCount === 1 || callCount === 3) return draft;

        return { fetchFileCommits };
      });

      const { fetchEntryHistory } = await importModule();
      const result1 = await fetchEntryHistory();

      expect(result1.error).toBe(true);

      // Second call should return cached error
      const result2 = await fetchEntryHistory();

      expect(result2).toBe(result1);
      expect(fetchFileCommits).toHaveBeenCalledTimes(1);
    });
  });

  describe('clearEntryHistoryCache()', () => {
    test('clears cache for the current entry', async () => {
      const commits = [{ sha: 'abc', authorName: 'Alice', date: '2025-01-01' }];
      const fetchFileCommits = vi.fn().mockResolvedValue(commits);

      const draft = {
        id: 'entry-6',
        originalEntry: {
          id: 'entry-6',
          locales: { _default: { path: 'content/posts/hello.md' } },
        },
      };

      let callCount = 0;

      mockGet.mockImplementation(() => {
        callCount += 1;

        if (callCount % 2 === 1) return draft;

        return { fetchFileCommits };
      });

      const { fetchEntryHistory, clearEntryHistoryCache } = await importModule();

      await fetchEntryHistory();

      expect(fetchFileCommits).toHaveBeenCalledTimes(1);

      // Clear cache
      clearEntryHistoryCache();

      // Reset callCount for a fresh pair of get() calls
      callCount = 0;

      // Should fetch again
      await fetchEntryHistory();

      expect(fetchFileCommits).toHaveBeenCalledTimes(2);
    });

    test('does nothing when there is no draft', async () => {
      mockGet.mockReturnValue(undefined);

      const { clearEntryHistoryCache } = await importModule();

      // Should not throw
      expect(() => clearEntryHistoryCache()).not.toThrow();
    });

    test('retains cache for other entries after clearing one', async () => {
      const commits1 = [{ sha: 'aaa', authorName: 'Alice', date: '2025-01-01' }];
      const commits2 = [{ sha: 'bbb', authorName: 'Bob', date: '2025-01-02' }];
      const fetchFileCommits = vi.fn();

      const draft1 = {
        id: 'entry-a',
        originalEntry: {
          id: 'entry-a',
          locales: { _default: { path: 'content/posts/a.md' } },
        },
      };

      const draft2 = {
        id: 'entry-b',
        originalEntry: {
          id: 'entry-b',
          locales: { _default: { path: 'content/posts/b.md' } },
        },
      };

      const backendObj = { fetchFileCommits };
      const { fetchEntryHistory, clearEntryHistoryCache } = await importModule();

      // Fetch entry A
      fetchFileCommits.mockResolvedValue(commits1);

      let callCount = 0;

      mockGet.mockImplementation(() => {
        callCount += 1;

        return callCount % 2 === 1 ? draft1 : backendObj;
      });

      const resultA = await fetchEntryHistory();

      expect(resultA.commits).toEqual(commits1);

      // Fetch entry B
      fetchFileCommits.mockResolvedValue(commits2);
      callCount = 0;

      mockGet.mockImplementation(() => {
        callCount += 1;

        return callCount % 2 === 1 ? draft2 : backendObj;
      });

      const resultB = await fetchEntryHistory();

      expect(resultB.commits).toEqual(commits2);
      expect(fetchFileCommits).toHaveBeenCalledTimes(2);

      // Clear cache for entry B only
      mockGet.mockReturnValue(draft2);
      clearEntryHistoryCache();

      // Entry A should still be cached
      callCount = 0;

      mockGet.mockImplementation(() => {
        callCount += 1;

        return callCount % 2 === 1 ? draft1 : backendObj;
      });

      const resultA2 = await fetchEntryHistory();

      expect(resultA2).toBe(resultA);
      expect(fetchFileCommits).toHaveBeenCalledTimes(2); // No additional fetch
    });
  });
});
