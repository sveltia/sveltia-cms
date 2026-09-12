// @ts-nocheck
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyDefaultBranch,
  getRepoURL,
  initRepositoryInfo,
  REPOSITORY_INFO_PLACEHOLDER,
} from './repository';

const mockPrefs = vi.hoisted(() => ({ devModeEnabled: false }));

vi.mock('@sveltia/i18n', () => ({
  _: vi.fn((key, { values } = {}) => `${key}:${JSON.stringify(values)}`),
}));
vi.mock('$lib/services/user/prefs.svelte', () => ({ prefs: mockPrefs }));

describe('git/shared/repository', () => {
  describe('REPOSITORY_INFO_PLACEHOLDER', () => {
    it('should have all required repository info properties', () => {
      expect(REPOSITORY_INFO_PLACEHOLDER).toEqual({
        service: '',
        label: '',
        owner: '',
        repo: '',
        branch: '',
        repoURL: '',
        treeBaseURL: '',
        blobBaseURL: '',
        isSelfHosted: false,
        databaseName: '',
      });
    });

    it('should have empty string values for string properties', () => {
      const stringProperties = [
        'service',
        'label',
        'owner',
        'repo',
        'branch',
        'repoURL',
        'treeBaseURL',
        'blobBaseURL',
        'databaseName',
      ];

      stringProperties.forEach((prop) => {
        expect(REPOSITORY_INFO_PLACEHOLDER[prop]).toBe('');
      });
    });

    it('should have false as default for isSelfHosted', () => {
      expect(REPOSITORY_INFO_PLACEHOLDER.isSelfHosted).toBe(false);
    });

    it('should be immutable placeholder object', () => {
      const original = { ...REPOSITORY_INFO_PLACEHOLDER };

      // Try to modify the placeholder (this shouldn't affect the original)
      REPOSITORY_INFO_PLACEHOLDER.service = 'github';

      expect(REPOSITORY_INFO_PLACEHOLDER.service).toBe('github');
      expect(original.service).toBe('');
    });
  });

  describe('getRepoURL', () => {
    const defaultRepoPath = 'owner/repo';

    it('should handle GitHub.com API URL correctly', () => {
      const restApiRoot = 'https://api.github.com';
      const expected = 'https://github.com/owner/repo';

      expect(getRepoURL(restApiRoot, defaultRepoPath)).toBe(expected);
    });

    it('should extract base URL from GitHub Enterprise Server API URL', () => {
      const restApiRoot = 'https://github.example.com/api/v3';
      const expected = 'https://github.example.com/owner/repo';

      expect(getRepoURL(restApiRoot, defaultRepoPath)).toBe(expected);
    });

    it('should extract base URL from GitLab API URL', () => {
      const restApiRoot = 'https://gitlab.example.com/api/v4';
      const expected = 'https://gitlab.example.com/owner/repo';

      expect(getRepoURL(restApiRoot, defaultRepoPath)).toBe(expected);
    });

    it('should extract base URL from Gitea API URL', () => {
      const restApiRoot = 'https://example.com/gitea/api/v1';
      const expected = 'https://example.com/gitea/owner/repo';

      expect(getRepoURL(restApiRoot, defaultRepoPath)).toBe(expected);
    });

    it('should extract base URL from custom self-hosted API URL', () => {
      const restApiRoot = 'https://git.company.com/api/v3';
      const repoPath = 'team/project';
      const expected = 'https://git.company.com/team/project';

      expect(getRepoURL(restApiRoot, repoPath)).toBe(expected);
    });

    it('should handle API URL with nested path', () => {
      const restApiRoot = 'https://example.com/git/api/v3/extra';
      const expected = 'https://example.com/git/owner/repo';

      expect(getRepoURL(restApiRoot, defaultRepoPath)).toBe(expected);
    });

    it('should return URL with repo path if no /api path is found', () => {
      const restApiRoot = 'https://example.com/git';
      const expected = 'https://example.com/git/owner/repo';

      expect(getRepoURL(restApiRoot, defaultRepoPath)).toBe(expected);
    });

    it('should handle URL with /api at the end', () => {
      const restApiRoot = 'https://example.com/api';
      const expected = 'https://example.com/owner/repo';

      expect(getRepoURL(restApiRoot, defaultRepoPath)).toBe(expected);
    });

    it('should handle empty string inputs', () => {
      const expected = '/';

      expect(getRepoURL('', '')).toBe(expected);
    });

    it('should handle URL with multiple /api segments (first occurrence)', () => {
      const restApiRoot = 'https://example.com/some/api/path/api/v1';
      const expected = 'https://example.com/some/owner/repo';

      expect(getRepoURL(restApiRoot, defaultRepoPath)).toBe(expected);
    });

    it('should handle URL with port number', () => {
      const restApiRoot = 'https://gitlab.local:8080/api/v4';
      const repoPath = 'group/project';
      const expected = 'https://gitlab.local:8080/group/project';

      expect(getRepoURL(restApiRoot, repoPath)).toBe(expected);
    });

    it('should handle URL with subdirectory and API path', () => {
      const restApiRoot = 'https://example.com/git/server/api/v1';
      const expected = 'https://example.com/git/server/owner/repo';

      expect(getRepoURL(restApiRoot, defaultRepoPath)).toBe(expected);
    });

    it('should handle complex repository paths', () => {
      const restApiRoot = 'https://gitlab.example.com/api/v4';
      const repoPath = 'group/subgroup/project';
      const expected = 'https://gitlab.example.com/group/subgroup/project';

      expect(getRepoURL(restApiRoot, repoPath)).toBe(expected);
    });

    it('should handle API URL with version numbers correctly', () => {
      const restApiRoot = 'https://github.example.com/api/v3';
      const expected = 'https://github.example.com/owner/repo';

      expect(getRepoURL(restApiRoot, defaultRepoPath)).toBe(expected);
    });
  });

  describe('initRepositoryInfo', () => {
    const getTokenPageURL = vi.fn((repoURL) => `${repoURL}/tokens`);

    const getBaseURLs = vi.fn((repoURL, branch) => ({
      treeBaseURL: `${repoURL}/tree/${branch}`,
      blobBaseURL: `${repoURL}/blob/${branch}`,
      commitBaseURL: `${repoURL}/commit`,
    }));

    const args = {
      service: 'github',
      label: 'GitHub',
      owner: 'owner',
      repo: 'repo',
      branch: 'main',
      restApiRoot: 'https://api.github.com',
      defaultApiRoot: 'https://api.github.com',
      getTokenPageURL,
      getBaseURLs,
    };

    beforeEach(() => {
      mockPrefs.devModeEnabled = false;
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should fill in the repository info in place and return it', () => {
      const repository = { ...REPOSITORY_INFO_PLACEHOLDER };
      const result = initRepositoryInfo(repository, args);

      expect(result).toBe(repository);
      expect(repository).toEqual({
        service: 'github',
        label: 'GitHub',
        owner: 'owner',
        repo: 'repo',
        branch: 'main',
        repoURL: 'https://github.com/owner/repo',
        tokenPageURL: 'https://github.com/owner/repo/tokens',
        databaseName: 'github:owner/repo',
        isSelfHosted: false,
        treeBaseURL: 'https://github.com/owner/repo/tree/main',
        blobBaseURL: 'https://github.com/owner/repo/blob/main',
        commitBaseURL: 'https://github.com/owner/repo/commit',
      });
      expect(getTokenPageURL).toHaveBeenCalledWith('https://github.com/owner/repo');
      expect(getBaseURLs).toHaveBeenCalledWith('https://github.com/owner/repo', 'main');
    });

    it('should mark a non-default API root as self-hosted', () => {
      const repository = initRepositoryInfo(
        { ...REPOSITORY_INFO_PLACEHOLDER },
        { ...args, restApiRoot: 'https://github.example.com/api/v3', branch: undefined },
      );

      expect(repository.isSelfHosted).toBe(true);
      expect(repository.repoURL).toBe('https://github.example.com/owner/repo');
      expect(getBaseURLs).toHaveBeenCalledWith('https://github.example.com/owner/repo', undefined);
    });

    it('should log the repository info in dev mode', () => {
      const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      mockPrefs.devModeEnabled = true;

      const repository = initRepositoryInfo({ ...REPOSITORY_INFO_PLACEHOLDER }, args);

      expect(consoleInfoSpy).toHaveBeenCalledWith('repositoryInfo', repository);
    });

    it('should not log the repository info when dev mode is off', () => {
      const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      initRepositoryInfo({ ...REPOSITORY_INFO_PLACEHOLDER }, args);

      expect(consoleInfoSpy).not.toHaveBeenCalled();
    });
  });

  describe('applyDefaultBranch', () => {
    const getBaseURLs = vi.fn((repoURL, branch) => ({
      treeBaseURL: `${repoURL}/tree/${branch}`,
      blobBaseURL: `${repoURL}/blob/${branch}`,
    }));

    /**
     * Create a repository info object to be updated.
     * @returns {object} Repository info.
     */
    const createRepository = () => ({
      ...REPOSITORY_INFO_PLACEHOLDER,
      repo: 'repo',
      repoURL: 'https://github.com/owner/repo',
    });

    it('should apply the branch and base URLs to the repository info', () => {
      const repository = createRepository();
      const result = applyDefaultBranch(repository, { found: true, branch: 'main', getBaseURLs });

      expect(result).toBe('main');
      expect(repository).toMatchObject({
        branch: 'main',
        treeBaseURL: 'https://github.com/owner/repo/tree/main',
        blobBaseURL: 'https://github.com/owner/repo/blob/main',
      });
      expect(getBaseURLs).toHaveBeenCalledWith('https://github.com/owner/repo', 'main');
    });

    it('should throw when the repository was not found', () => {
      const repository = createRepository();

      expect(() =>
        applyDefaultBranch(repository, { found: false, branch: undefined, getBaseURLs }),
      ).toThrow(
        expect.objectContaining({
          message: 'Failed to retrieve the default branch name.',
          cause: expect.objectContaining({ message: 'repository_not_found:{"repo":"repo"}' }),
        }),
      );
      expect(repository.branch).toBe('');
    });

    it('should throw when the repository is empty', () => {
      const repository = createRepository();

      expect(() =>
        applyDefaultBranch(repository, { found: true, branch: undefined, getBaseURLs }),
      ).toThrow(
        expect.objectContaining({
          message: 'Failed to retrieve the default branch name.',
          cause: expect.objectContaining({ message: 'repository_empty:{"repo":"repo"}' }),
        }),
      );
      expect(repository.branch).toBe('');
    });

    it('should tolerate a missing `repoURL`', () => {
      const repository = { ...createRepository(), repoURL: undefined };

      applyDefaultBranch(repository, { found: true, branch: 'main', getBaseURLs });

      expect(getBaseURLs).toHaveBeenCalledWith('', 'main');
    });
  });
});
