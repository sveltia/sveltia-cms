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
vi.mock('@sveltia/i18n', () => ({
  _: vi.fn(() => 'Translation message'),
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
        commitBaseURL: `${repoURL}/commit`,
      });
    });

    test('handles undefined branch', () => {
      const repoURL = 'https://github.com/owner/repo';
      const result = getBaseURLs(repoURL, undefined);

      expect(result).toEqual({
        treeBaseURL: repoURL,
        blobBaseURL: '',
        commitBaseURL: `${repoURL}/commit`,
      });
    });
  });

  describe('checkRepositoryAccess', () => {
    beforeEach(() => {
      Object.assign(repository, { owner: 'test-owner', repo: 'test-repo' });
    });

    test('succeeds when the user can push to the repository', async () => {
      vi.mocked(fetchAPI).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ permissions: { pull: true, push: true } }),
      });

      await expect(checkRepositoryAccess()).resolves.toBeUndefined();
      expect(fetchAPI).toHaveBeenCalledWith(
        '/repos/test-owner/test-repo',
        expect.objectContaining({
          headers: { Accept: 'application/json' },
          responseType: 'raw',
        }),
      );
    });

    test('throws error when the user can only read the repository', async () => {
      vi.mocked(fetchAPI).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ permissions: { pull: true, push: false } }),
      });

      await expect(checkRepositoryAccess()).rejects.toThrow('Not a collaborator of the repository');
    });

    test('throws error when the repository reports no permissions', async () => {
      vi.mocked(fetchAPI).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({}),
      });

      await expect(checkRepositoryAccess()).rejects.toThrow('Not a collaborator of the repository');
    });

    test('throws error when the repository is not visible to the user', async () => {
      const mockResponse = { ok: false, json: vi.fn() };

      vi.mocked(fetchAPI).mockResolvedValue(mockResponse);

      await expect(checkRepositoryAccess()).rejects.toThrow('Not a collaborator of the repository');
      expect(mockResponse.json).not.toHaveBeenCalled();
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
