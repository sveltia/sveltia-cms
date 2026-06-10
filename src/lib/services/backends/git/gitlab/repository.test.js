import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  checkRepositoryAccess,
  fetchDefaultBranchName,
  getBaseURLs,
  repository,
} from '$lib/services/backends/git/gitlab/repository';
import { fetchAPI, fetchGraphQL } from '$lib/services/backends/git/shared/api';

const { mockUserAccount } = vi.hoisted(() => ({
  mockUserAccount: { id: 123, login: 'test-user', bot: false },
}));

// Mock dependencies
vi.mock('$lib/services/backends/git/shared/api');
vi.mock('$lib/services/user/account.svelte', () => ({
  user: {
    // eslint-disable-next-line jsdoc/require-jsdoc
    get account() {
      return mockUserAccount;
    },
  },
}));
vi.mock('@sveltia/i18n', () => ({
  _: vi.fn(() => 'Translation message'),
}));
describe('GitLab repository service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(mockUserAccount, { id: 123, login: 'test-user', bot: false });
  });

  describe('repository object', () => {
    test('has expected structure', () => {
      expect(repository).toBeDefined();
      expect(typeof repository).toBe('object');
    });
  });

  describe('getBaseURLs', () => {
    test('returns correct URLs for repository with branch', () => {
      const repoURL = 'https://gitlab.com/owner/repo';
      const branch = 'main';
      const result = getBaseURLs(repoURL, branch);

      expect(result).toEqual({
        treeBaseURL: `${repoURL}/-/tree/${branch}`,
        blobBaseURL: `${repoURL}/-/blob/${branch}`,
        commitBaseURL: `${repoURL}/-/commit`,
      });
    });

    test('handles undefined branch', () => {
      const repoURL = 'https://gitlab.com/owner/repo';
      const result = getBaseURLs(repoURL, undefined);

      expect(result).toEqual({
        treeBaseURL: repoURL,
        blobBaseURL: '',
        commitBaseURL: `${repoURL}/-/commit`,
      });
    });
  });

  describe('checkRepositoryAccess', () => {
    test('succeeds when the user is an active collaborator', async () => {
      Object.assign(repository, {
        owner: 'test-owner',
        repo: 'test-repo',
      });

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([{ id: 123, state: 'active' }]),
      };

      vi.mocked(fetchAPI).mockResolvedValue(mockResponse);

      await expect(checkRepositoryAccess()).resolves.toBeUndefined();
      expect(fetchAPI).toHaveBeenCalledWith(
        '/projects/test-owner%2Ftest-repo/users?search=test-user',
        expect.objectContaining({
          headers: { Accept: 'application/json' },
          responseType: 'raw',
        }),
      );
    });

    test('throws error when the user is not an active collaborator', async () => {
      Object.assign(repository, {
        owner: 'test-owner',
        repo: 'test-repo',
      });

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([{ id: 456, state: 'active' }]),
      };

      vi.mocked(fetchAPI).mockResolvedValue(mockResponse);

      await expect(checkRepositoryAccess()).rejects.toThrow('Not a collaborator of the repository');
    });

    test('throws error when the access check request itself fails', async () => {
      Object.assign(repository, {
        owner: 'test-owner',
        repo: 'test-repo',
      });

      const mockResponse = {
        ok: false,
        json: vi.fn(),
      };

      vi.mocked(fetchAPI).mockResolvedValue(mockResponse);

      await expect(checkRepositoryAccess()).rejects.toThrow('Not a collaborator of the repository');
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    test('uses service account lookup for bot users', async () => {
      Object.assign(repository, {
        owner: 'test-owner',
        repo: 'test-repo',
      });

      Object.assign(mockUserAccount, { id: 999, login: 'bot-user', bot: true });

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([{ id: 999 }]),
      };

      vi.mocked(fetchAPI).mockResolvedValue(mockResponse);

      await expect(checkRepositoryAccess()).resolves.toBeUndefined();
      expect(fetchAPI).toHaveBeenCalledWith(
        '/projects/test-owner%2Ftest-repo/service_accounts',
        expect.objectContaining({
          headers: { Accept: 'application/json' },
          responseType: 'raw',
        }),
      );
    });
  });

  describe('fetchDefaultBranchName', () => {
    test('fetches default branch name successfully', async () => {
      Object.assign(repository, {
        owner: 'test-owner',
        repo: 'test-repo',
        repoURL: 'https://gitlab.com/test-owner/test-repo',
      });

      const mockResponse = {
        project: {
          repository: {
            rootRef: 'main',
          },
        },
      };

      vi.mocked(fetchGraphQL).mockResolvedValue(mockResponse);

      const result = await fetchDefaultBranchName();

      expect(result).toBe('main');
      expect(fetchGraphQL).toHaveBeenCalledWith(expect.stringContaining('query'));
    });

    test('throws error when project not found', async () => {
      Object.assign(repository, {
        owner: 'test-owner',
        repo: 'nonexistent-repo',
      });

      const mockResponse = {
        project: null,
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
        project: {
          repository: {
            rootRef: null,
          },
        },
      };

      vi.mocked(fetchGraphQL).mockResolvedValue(mockResponse);

      await expect(fetchDefaultBranchName()).rejects.toThrow(
        'Failed to retrieve the default branch name.',
      );
    });

    test('throws error when repository does not exist on project', async () => {
      Object.assign(repository, {
        owner: 'test-owner',
        repo: 'no-repo',
      });

      const mockResponse = {
        project: {
          repository: null,
        },
      };

      vi.mocked(fetchGraphQL).mockResolvedValue(mockResponse);

      await expect(fetchDefaultBranchName()).rejects.toThrow(
        'Failed to retrieve the default branch name.',
      );
    });
  });
});
