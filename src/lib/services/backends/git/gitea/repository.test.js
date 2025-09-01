import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { REPOSITORY_INFO_PLACEHOLDER } from '$lib/services/backends/git/shared/repository';

import {
  checkRepositoryAccess,
  fetchDefaultBranchName,
  getBaseURLs,
  getPatURL,
  getRepositoryInfo,
  repository,
  resetRepositoryInfoCache,
} from './repository.js';

// Mock dependencies with vi.hoisted to ensure proper hoisting
const getMock = vi.hoisted(() => vi.fn());
const fetchAPIMock = vi.hoisted(() => vi.fn());

vi.mock('svelte/store', () => ({
  get: getMock,
}));

vi.mock('svelte-i18n', () => ({
  _: {}, // Mock _ as a store-like object
}));

vi.mock('$lib/services/backends/git/shared/api', () => ({
  fetchAPI: fetchAPIMock,
}));

describe('Gitea Repository Service', () => {
  const mockRepo = 'test-repo';
  const mockOwner = 'test-owner';
  const mockRepoURL = 'https://gitea.example.com/test-owner/test-repo';

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset the repository info cache
    resetRepositoryInfoCache();

    // Mock get(_) to return a translation function (following pattern from other tests)
    // @ts-ignore
    getMock.mockReturnValue((key, options) => {
      switch (key) {
        case 'repository_no_access':
          return `No access to repository ${options?.values?.repo || 'unknown'}`;
        case 'repository_not_found':
          return `Repository ${options?.values?.repo || 'unknown'} not found`;
        case 'repository_empty':
          return `Repository ${options?.values?.repo || 'unknown'} is empty`;
        default:
          return key;
      }
    });

    // Reset repository object
    Object.assign(repository, {
      ...REPOSITORY_INFO_PLACEHOLDER,
      owner: mockOwner,
      repo: mockRepo,
      repoURL: mockRepoURL,
    });
  });

  afterEach(() => {
    // Reset the repository cache between tests
    vi.resetModules();
  });

  describe('getBaseURLs', () => {
    test('should generate correct URLs with branch', () => {
      const repoURL = 'https://gitea.example.com/owner/repo';
      const branch = 'main';
      const result = getBaseURLs(repoURL, branch);

      expect(result).toEqual({
        treeBaseURL: 'https://gitea.example.com/owner/repo/src/branch/main',
        blobBaseURL: 'https://gitea.example.com/owner/repo/src/branch/main',
      });
    });

    test('should generate correct URLs without branch', () => {
      const repoURL = 'https://gitea.example.com/owner/repo';
      const result = getBaseURLs(repoURL);

      expect(result).toEqual({
        treeBaseURL: 'https://gitea.example.com/owner/repo',
        blobBaseURL: '',
      });
    });

    test('should handle empty repoURL', () => {
      const result = getBaseURLs('', 'main');

      expect(result).toEqual({
        treeBaseURL: '/src/branch/main',
        blobBaseURL: '/src/branch/main',
      });
    });
  });

  describe('getPatURL', () => {
    test('returns correct Gitea Personal Access Token URL', () => {
      const repoURL = 'https://gitea.com/owner/repo';
      const result = getPatURL(repoURL);

      expect(result).toBe('https://gitea.com/user/settings/applications');
    });

    test('handles Forgejo instance URLs', () => {
      const repoURL = 'https://codeberg.org/owner/repo';
      const result = getPatURL(repoURL);

      expect(result).toBe('https://codeberg.org/user/settings/applications');
    });

    test('handles self-hosted Gitea instance URLs', () => {
      const repoURL = 'https://git.example.com/owner/repo';
      const result = getPatURL(repoURL);

      expect(result).toBe('https://git.example.com/user/settings/applications');
    });

    test('handles different repository paths', () => {
      const repoURL = 'https://gitea.example.com/different-owner/different-repo';
      const result = getPatURL(repoURL);

      expect(result).toBe('https://gitea.example.com/user/settings/applications');
    });

    test('handles URLs with ports', () => {
      const repoURL = 'https://gitea.example.com:3000/owner/repo';
      const result = getPatURL(repoURL);

      expect(result).toBe('https://gitea.example.com:3000/user/settings/applications');
    });
  });

  describe('checkRepositoryAccess', () => {
    test('should pass when user has pull permissions', async () => {
      const mockRepoInfo = {
        permissions: {
          pull: true,
          push: true,
        },
      };

      fetchAPIMock.mockResolvedValue(mockRepoInfo);

      await expect(checkRepositoryAccess()).resolves.toBeUndefined();
      expect(fetchAPIMock).toHaveBeenCalledWith(`/repos/${mockOwner}/${mockRepo}`);
    });

    test('should throw error when user has no pull permissions', async () => {
      const mockRepoInfo = {
        permissions: {
          pull: false,
          push: false,
        },
      };

      fetchAPIMock.mockResolvedValue(mockRepoInfo);

      await expect(checkRepositoryAccess()).rejects.toThrow('Not a collaborator of the repository');
    });

    test('should throw error when permissions are missing', async () => {
      const mockRepoInfo = {};

      fetchAPIMock.mockResolvedValue(mockRepoInfo);

      await expect(checkRepositoryAccess()).rejects.toThrow('Not a collaborator of the repository');
    });

    test('should handle API fetch error', async () => {
      fetchAPIMock.mockRejectedValue(new Error('Network error'));

      await expect(checkRepositoryAccess()).rejects.toThrow('Failed to check repository access');
    });

    test('should re-throw collaborator errors', async () => {
      const collaboratorError = new Error('Not a collaborator of the repository');

      fetchAPIMock.mockRejectedValue(collaboratorError);

      await expect(checkRepositoryAccess()).rejects.toThrow('Not a collaborator of the repository');
    });
  });

  describe('fetchDefaultBranchName', () => {
    test('should fetch and return default branch name', async () => {
      const mockRepoInfo = {
        default_branch: 'main',
      };

      fetchAPIMock.mockResolvedValue(mockRepoInfo);

      const result = await fetchDefaultBranchName();

      expect(result).toBe('main');
      expect(fetchAPIMock).toHaveBeenCalledWith(`/repos/${mockOwner}/${mockRepo}`);
      expect(repository.branch).toBe('main');
      expect(repository.treeBaseURL).toBe(`${mockRepoURL}/src/branch/main`);
      expect(repository.blobBaseURL).toBe(`${mockRepoURL}/src/branch/main`);
    });

    test('should handle empty repository with no default branch', async () => {
      const mockRepoInfo = {
        default_branch: null,
      };

      fetchAPIMock.mockResolvedValue(mockRepoInfo);

      await expect(fetchDefaultBranchName()).rejects.toThrow(
        'Failed to retrieve the default branch name.',
      );
    });

    test('should handle missing default_branch property', async () => {
      const mockRepoInfo = {};

      fetchAPIMock.mockResolvedValue(mockRepoInfo);

      await expect(fetchDefaultBranchName()).rejects.toThrow(
        'Failed to retrieve the default branch name.',
      );
    });

    test('should handle API fetch error', async () => {
      fetchAPIMock.mockRejectedValue(new Error('Network error'));

      await expect(fetchDefaultBranchName()).rejects.toThrow(
        'Failed to retrieve the default branch name.',
      );
    });

    test('should update repository with URLs when repoURL is empty', async () => {
      repository.repoURL = '';

      const mockRepoInfo = {
        default_branch: 'develop',
      };

      fetchAPIMock.mockResolvedValue(mockRepoInfo);

      const result = await fetchDefaultBranchName();

      expect(result).toBe('develop');
      expect(repository.branch).toBe('develop');
      expect(repository.treeBaseURL).toBe('/src/branch/develop');
      expect(repository.blobBaseURL).toBe('/src/branch/develop');
    });
  });

  describe('repository caching', () => {
    test('should cache repository info between calls', async () => {
      const mockRepoInfo = {
        permissions: { pull: true },
        default_branch: 'main',
      };

      fetchAPIMock.mockResolvedValue(mockRepoInfo);

      // First call
      await checkRepositoryAccess();
      // Second call
      await checkRepositoryAccess();

      // Should only call API once due to caching
      expect(fetchAPIMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('repository object', () => {
    test('should initialize with placeholder values', () => {
      const freshRepo = { ...REPOSITORY_INFO_PLACEHOLDER };

      expect(freshRepo).toHaveProperty('service');
      expect(freshRepo).toHaveProperty('owner');
      expect(freshRepo).toHaveProperty('repo');
      expect(freshRepo).toHaveProperty('branch');
    });

    test('should be mutable for configuration', () => {
      repository.owner = 'new-owner';
      repository.repo = 'new-repo';

      expect(repository.owner).toBe('new-owner');
      expect(repository.repo).toBe('new-repo');
    });
  });

  describe('getRepositoryInfo', () => {
    test('should fetch and return repository information', async () => {
      const mockRepoInfo = {
        id: 123,
        name: 'test-repo',
        full_name: 'test-owner/test-repo',
        description: 'Test repository',
        default_branch: 'main',
        permissions: {
          admin: false,
          pull: true,
          push: true,
        },
      };

      fetchAPIMock.mockResolvedValue(mockRepoInfo);

      const result = await getRepositoryInfo();

      expect(result).toEqual(mockRepoInfo);
      expect(fetchAPIMock).toHaveBeenCalledWith(`/repos/${mockOwner}/${mockRepo}`);
    });

    test('should cache repository information between calls', async () => {
      const mockRepoInfo = {
        id: 123,
        name: 'test-repo',
        permissions: { pull: true },
      };

      fetchAPIMock.mockResolvedValue(mockRepoInfo);

      // First call
      const result1 = await getRepositoryInfo();
      // Second call
      const result2 = await getRepositoryInfo();

      expect(result1).toBe(result2); // Should return the same cached object
      expect(fetchAPIMock).toHaveBeenCalledTimes(1); // API should only be called once
    });

    test('should handle API fetch error', async () => {
      const error = new Error('Repository not found');

      fetchAPIMock.mockRejectedValue(error);

      await expect(getRepositoryInfo()).rejects.toThrow('Repository not found');
      expect(fetchAPIMock).toHaveBeenCalledWith(`/repos/${mockOwner}/${mockRepo}`);
    });

    test('should use cached data after successful fetch', async () => {
      // Reset cache first
      resetRepositoryInfoCache();

      const mockRepoInfo = {
        id: 456,
        name: 'cached-repo',
        permissions: { pull: true, push: false },
      };

      fetchAPIMock.mockResolvedValue(mockRepoInfo);

      // First call should fetch from API
      const result1 = await getRepositoryInfo();

      // Clear the mock to ensure no more API calls
      fetchAPIMock.mockClear();

      // Second call should use cached data
      const result2 = await getRepositoryInfo();

      expect(result1).toEqual(mockRepoInfo);
      expect(result2).toEqual(mockRepoInfo);
      expect(result1).toBe(result2); // Same object reference (cached)
      expect(fetchAPIMock).not.toHaveBeenCalled(); // No additional API calls
    });
  });
});
