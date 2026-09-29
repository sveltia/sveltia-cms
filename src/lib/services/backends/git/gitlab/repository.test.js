import { beforeEach, describe, expect, test, vi } from 'vitest';

import { lockedBranch } from '$lib/services/backends/branch-access';
import {
  checkBranchAccess,
  checkRepositoryAccess,
  fetchDefaultBranchName,
  getBaseURLs,
  getProjectId,
  repository,
} from '$lib/services/backends/git/gitlab/repository';
import { fetchAPI, fetchGraphQL } from '$lib/services/backends/git/shared/api';

// Mock dependencies
vi.mock('$lib/services/backends/git/shared/api');
vi.mock('@sveltia/i18n', () => ({
  _: vi.fn(() => 'Translation message'),
}));

describe('GitLab repository service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('repository object', () => {
    test('has expected structure', () => {
      expect(repository).toBeDefined();
      expect(typeof repository).toBe('object');
    });
  });

  describe('getProjectId', () => {
    test('returns the percent-encoded project path', () => {
      Object.assign(repository, { owner: 'group/subgroup', repo: 'project' });

      expect(getProjectId()).toBe('group%2Fsubgroup%2Fproject');
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
    beforeEach(() => {
      Object.assign(repository, { owner: 'test-owner', repo: 'test-repo' });
    });

    test('succeeds when the user can push to the repository', async () => {
      vi.mocked(fetchGraphQL).mockResolvedValue({
        project: { userPermissions: { pushCode: true } },
      });

      await expect(checkRepositoryAccess()).resolves.toBeUndefined();
      expect(fetchGraphQL).toHaveBeenCalledWith(expect.stringContaining('pushCode'));
    });

    test('throws error when the user has a role lower than Developer', async () => {
      vi.mocked(fetchGraphQL).mockResolvedValue({
        project: { userPermissions: { pushCode: false } },
      });

      await expect(checkRepositoryAccess()).rejects.toThrow('Not a collaborator of the repository');
    });

    test('throws error when the project is not visible to the user', async () => {
      vi.mocked(fetchGraphQL).mockResolvedValue({ project: null });

      await expect(checkRepositoryAccess()).rejects.toThrow('Not a collaborator of the repository');
    });
  });

  describe('checkBranchAccess', () => {
    beforeEach(() => {
      Object.assign(repository, { owner: 'test-owner', repo: 'test-repo', branch: 'release/1.0' });
      lockedBranch.current = undefined;
    });

    test('leaves the branch writable when the user can push to it', async () => {
      vi.mocked(fetchAPI).mockResolvedValue({ name: 'release/1.0', can_push: true });

      await checkBranchAccess();

      expect(lockedBranch.current).toBeUndefined();
      expect(fetchAPI).toHaveBeenCalledWith(
        '/projects/test-owner%2Ftest-repo/repository/branches/release%2F1.0',
      );
    });

    test('locks the branch when the user can’t push to it', async () => {
      vi.mocked(fetchAPI).mockResolvedValue({ name: 'release/1.0', can_push: false });

      await checkBranchAccess();

      expect(lockedBranch.current).toBe('release/1.0');
    });

    test('unlocks the branch when the user can push to it again', async () => {
      lockedBranch.current = 'release/1.0';
      vi.mocked(fetchAPI).mockResolvedValue({ name: 'release/1.0', can_push: true });

      await checkBranchAccess();

      expect(lockedBranch.current).toBeUndefined();
    });

    test('leaves the branch writable when the request fails', async () => {
      lockedBranch.current = 'release/1.0';
      vi.mocked(fetchAPI).mockRejectedValue(new Error('Not Found'));

      await expect(checkBranchAccess()).resolves.toBeUndefined();
      expect(lockedBranch.current).toBeUndefined();
    });

    test('leaves the branch writable when the branch is unknown', async () => {
      Object.assign(repository, { branch: undefined });

      await checkBranchAccess();

      expect(lockedBranch.current).toBeUndefined();
      expect(fetchAPI).not.toHaveBeenCalled();
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
