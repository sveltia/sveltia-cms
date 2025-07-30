import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  checkRepositoryAccess,
  fetchDefaultBranchName,
  getBaseURLs,
  repository,
} from '$lib/services/backends/git/github/repository';
import { fetchAPI, fetchGraphQL } from '$lib/services/backends/git/shared/api';

// Mock dependencies
vi.mock('$lib/services/backends/git/shared/api');
vi.mock('$lib/services/user', () => ({
  user: { subscribe: vi.fn() },
}));
vi.mock('svelte-i18n', () => ({
  _: {
    subscribe: vi.fn(),
    set: vi.fn(),
  },
  get: vi.fn().mockReturnValue(() => 'Translation message'),
}));
vi.mock('svelte/store', () => ({
  get: vi.fn().mockImplementation((store) => {
    // Check if this is the user store
    if (store && store.subscribe) {
      // Check if it's the translation store by looking at its structure
      if (store.subscribe && store.set) {
        // This is the translation store - return a translation function
        return () => 'Translation message';
      }

      // This is the user store - return user data
      return { login: 'test-user' };
    }

    // Default return
    return {};
  }),
}));

describe('GitHub repository service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('repository object', () => {
    test('has expected structure', () => {
      expect(repository).toBeDefined();
      expect(typeof repository).toBe('object');
    });
  });

  describe('getBaseURLs', () => {
    test('returns correct URLs for repository with branch', () => {
      const repoURL = 'https://github.com/owner/repo';
      const branch = 'main';
      const result = getBaseURLs(repoURL, branch);

      expect(result).toEqual({
        treeBaseURL: `${repoURL}/tree/${branch}`,
        blobBaseURL: `${repoURL}/blob/${branch}`,
      });
    });

    test('handles undefined branch', () => {
      const repoURL = 'https://github.com/owner/repo';
      const result = getBaseURLs(repoURL, undefined);

      expect(result).toEqual({
        treeBaseURL: repoURL,
        blobBaseURL: '',
      });
    });
  });

  describe('checkRepositoryAccess', () => {
    test('succeeds when user is a collaborator', async () => {
      Object.assign(repository, {
        owner: 'test-owner',
        repo: 'test-repo',
      });

      const mockResponse = { ok: true };

      vi.mocked(fetchAPI).mockResolvedValue(mockResponse);

      await expect(checkRepositoryAccess()).resolves.toBeUndefined();
      expect(fetchAPI).toHaveBeenCalledWith(
        '/repos/test-owner/test-repo/collaborators/test-user',
        expect.objectContaining({
          headers: { Accept: 'application/json' },
          responseType: 'raw',
        }),
      );
    });

    test('throws error when user is not a collaborator', async () => {
      Object.assign(repository, {
        owner: 'test-owner',
        repo: 'test-repo',
      });

      const mockResponse = { ok: false };

      vi.mocked(fetchAPI).mockResolvedValue(mockResponse);

      await expect(checkRepositoryAccess()).rejects.toThrow('Not a collaborator of the repository');
    });
  });

  describe('fetchDefaultBranchName', () => {
    test('fetches default branch name successfully', async () => {
      Object.assign(repository, {
        owner: 'test-owner',
        repo: 'test-repo',
        repoURL: 'https://github.com/test-owner/test-repo',
      });

      const mockResponse = {
        repository: {
          defaultBranchRef: {
            name: 'main',
          },
        },
      };

      vi.mocked(fetchGraphQL).mockResolvedValue(mockResponse);

      const result = await fetchDefaultBranchName();

      expect(result).toBe('main');
      expect(fetchGraphQL).toHaveBeenCalledWith(expect.stringContaining('query'));
    });

    test('throws error when repository not found', async () => {
      Object.assign(repository, {
        owner: 'test-owner',
        repo: 'nonexistent-repo',
      });

      const mockResponse = {
        repository: null,
      };

      vi.mocked(fetchGraphQL).mockResolvedValue(mockResponse);

      await expect(fetchDefaultBranchName()).rejects.toThrow(
        'Failed to retrieve the default branch name.',
      );
    });

    test('throws error when repository is empty', async () => {
      Object.assign(repository, {
        owner: 'test-owner',
        repo: 'empty-repo',
      });

      const mockResponse = {
        repository: {
          defaultBranchRef: null,
        },
      };

      vi.mocked(fetchGraphQL).mockResolvedValue(mockResponse);

      await expect(fetchDefaultBranchName()).rejects.toThrow(
        'Failed to retrieve the default branch name.',
      );
    });
  });
});
