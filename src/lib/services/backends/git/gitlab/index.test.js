import { stripSlashes } from '@sveltia/utils/string';
import { get } from 'svelte/store';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { signIn, signOut } from '$lib/services/backends/git/gitlab/auth';
import { commitChanges } from '$lib/services/backends/git/gitlab/commits';
import { BACKEND_LABEL, BACKEND_NAME } from '$lib/services/backends/git/gitlab/constants';
import { fetchBlob, fetchFiles } from '$lib/services/backends/git/gitlab/files';
import gitlabBackend, { init } from '$lib/services/backends/git/gitlab/index';
import { getBaseURLs, repository } from '$lib/services/backends/git/gitlab/repository';
import { checkStatus, STATUS_DASHBOARD_URL } from '$lib/services/backends/git/gitlab/status';
import { apiConfig, graphqlVars } from '$lib/services/backends/git/shared/api';

// Mock dependencies
vi.mock('@sveltia/utils/string');
vi.mock('svelte/store', () => ({
  get: vi.fn(),
  writable: vi.fn(() => ({ subscribe: vi.fn(), set: vi.fn(), update: vi.fn() })),
  derived: vi.fn(() => ({ subscribe: vi.fn() })),
  readonly: vi.fn(() => ({ subscribe: vi.fn() })),
}));
vi.mock('$lib/services/backends/git/gitlab/auth', () => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock('$lib/services/backends/git/gitlab/commits', () => ({
  commitChanges: vi.fn(),
}));
vi.mock('$lib/services/backends/git/gitlab/files', () => ({
  fetchBlob: vi.fn(),
  fetchFiles: vi.fn(),
}));
vi.mock('$lib/services/backends/git/gitlab/repository', () => ({
  repository: {},
  getBaseURLs: vi.fn(),
}));
vi.mock('$lib/services/backends/git/gitlab/status', () => ({
  checkStatus: vi.fn(),
  STATUS_DASHBOARD_URL: 'https://status.gitlab.com',
}));
vi.mock('$lib/services/backends/git/shared/api', () => ({
  apiConfig: {},
  graphqlVars: {},
}));
vi.mock('$lib/services/config', () => ({
  siteConfig: { subscribe: vi.fn() },
}));
vi.mock('$lib/services/user/prefs', () => ({
  prefs: { subscribe: vi.fn() },
}));

describe('GitLab backend service', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock default values
    vi.mocked(stripSlashes).mockImplementation((str) => str.replace(/^\/+|\/+$/g, ''));
    vi.mocked(getBaseURLs).mockReturnValue({
      treeBaseURL: 'https://gitlab.com/owner/repo/-/tree/main',
      blobBaseURL: 'https://gitlab.com/owner/repo/-/blob/main',
    });

    // Reset mocked objects
    Object.keys(repository).forEach((key) => delete (/** @type {any} */ (repository)[key]));
    Object.keys(apiConfig).forEach((key) => delete (/** @type {any} */ (apiConfig)[key]));
    Object.keys(graphqlVars).forEach((key) => delete (/** @type {any} */ (graphqlVars)[key]));

    vi.mocked(get).mockReturnValue({
      devModeEnabled: false,
    });
  });

  describe('init', () => {
    test('initializes GitLab backend with default configuration', () => {
      const mockConfig = {
        backend: {
          name: 'gitlab',
          repo: 'owner/repo',
          branch: 'main',
        },
      };

      vi.mocked(get).mockReturnValue(mockConfig);

      const result = init();

      expect(result).toBeDefined();
      expect(repository).toEqual(
        expect.objectContaining({
          service: 'gitlab',
          label: 'GitLab',
          owner: 'owner',
          repo: 'repo',
          branch: 'main',
          repoURL: 'https://gitlab.com/owner/repo',
          databaseName: 'gitlab:owner/repo',
          isSelfHosted: false,
        }),
      );

      expect(apiConfig).toEqual(
        expect.objectContaining({
          clientId: '',
          authURL: 'https://gitlab.com/oauth/authorize',
          tokenURL: 'https://gitlab.com/oauth/token',
          authScheme: 'Bearer',
          restBaseURL: 'https://gitlab.com/api/v4',
          graphqlBaseURL: 'https://gitlab.com/api/graphql',
        }),
      );

      expect(graphqlVars).toEqual({
        fullPath: 'owner/repo',
        branch: 'main',
      });
    });

    test('initializes GitLab backend with custom configuration', () => {
      const mockConfig = {
        backend: {
          name: 'gitlab',
          repo: 'group/subgroup/project',
          branch: 'develop',
          base_url: 'https://custom-gitlab.com',
          auth_endpoint: 'oauth/custom',
          app_id: 'custom-client-id',
          api_root: 'https://custom-gitlab.com/api/v4',
          graphql_api_root: 'https://custom-gitlab.com/api/graphql',
        },
      };

      vi.mocked(get).mockReturnValue(mockConfig);

      const result = init();

      expect(result).toBeDefined();
      expect(repository).toEqual(
        expect.objectContaining({
          service: 'gitlab',
          label: 'GitLab',
          owner: 'group/subgroup',
          repo: 'project',
          branch: 'develop',
          repoURL: 'https://custom-gitlab.com/group/subgroup/project',
          databaseName: 'gitlab:group/subgroup/project',
          isSelfHosted: true,
        }),
      );

      expect(apiConfig).toEqual(
        expect.objectContaining({
          clientId: 'custom-client-id',
          authURL: 'https://custom-gitlab.com/oauth/custom',
          tokenURL: 'https://custom-gitlab.com/oauth/custom', // No '/authorize' to replace
          authScheme: 'Bearer',
          restBaseURL: 'https://custom-gitlab.com/api/v4',
          graphqlBaseURL: 'https://custom-gitlab.com/api/graphql',
        }),
      );

      expect(graphqlVars).toEqual({
        fullPath: 'group/subgroup/project',
        branch: 'develop',
      });
    });

    test('handles project path with complex namespace', () => {
      const mockConfig = {
        backend: {
          name: 'gitlab',
          repo: 'group/sub-group/another-sub/project-name',
          branch: 'main',
        },
      };

      vi.mocked(get).mockReturnValue(mockConfig);

      init();

      expect(repository).toEqual(
        expect.objectContaining({
          owner: 'group/sub-group/another-sub',
          repo: 'project-name',
        }),
      );

      expect(graphqlVars).toEqual({
        fullPath: 'group/sub-group/another-sub/project-name',
        branch: 'main',
      });
    });

    test('returns undefined when backend is not GitLab', () => {
      const mockConfig = {
        backend: {
          name: 'github',
          repo: 'owner/repo',
        },
      };

      vi.mocked(get).mockReturnValue(mockConfig);

      const result = init();

      expect(result).toBeUndefined();
    });

    test('returns undefined when no site config', () => {
      vi.mocked(get).mockReturnValue(null);

      const result = init();

      expect(result).toBeUndefined();
    });

    test('returns undefined when no backend config', () => {
      const mockConfig = {};

      vi.mocked(get).mockReturnValue(mockConfig);

      const result = init();

      expect(result).toBeUndefined();
    });

    test('logs repository info in dev mode', () => {
      const mockConfig = {
        backend: {
          name: 'gitlab',
          repo: 'owner/repo',
          branch: 'main',
        },
      };

      const mockPrefs = {
        devModeEnabled: true,
      };

      vi.mocked(get)
        .mockReturnValueOnce(mockConfig) // for siteConfig
        .mockReturnValueOnce(mockPrefs); // for prefs

      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      init();

      expect(consoleSpy).toHaveBeenCalledWith('repositoryInfo', repository);
    });

    test('does not log repository info when dev mode disabled', () => {
      const mockConfig = {
        backend: {
          name: 'gitlab',
          repo: 'owner/repo',
          branch: 'main',
        },
      };

      const mockPrefs = {
        devModeEnabled: false,
      };

      vi.mocked(get)
        .mockReturnValueOnce(mockConfig) // for siteConfig
        .mockReturnValueOnce(mockPrefs); // for prefs

      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      init();

      expect(consoleSpy).not.toHaveBeenCalled();
    });

    test('handles invalid project path that does not match regex', () => {
      const mockConfig = {
        backend: {
          name: 'gitlab',
          repo: 'invalid-path-format', // This will not match the regex pattern
          branch: 'main',
        },
      };

      vi.mocked(get).mockReturnValue(mockConfig);

      const result = init();

      // Should still return something but with undefined owner/repo
      expect(result).toBeDefined();
      expect(repository.owner).toBeUndefined();
      expect(repository.repo).toBeUndefined();
    });
  });

  describe('default export', () => {
    test('exports correct backend service structure', () => {
      expect(gitlabBackend).toEqual({
        isGit: true,
        name: BACKEND_NAME,
        label: BACKEND_LABEL,
        repository,
        statusDashboardURL: STATUS_DASHBOARD_URL,
        checkStatus,
        init,
        signIn,
        signOut,
        fetchFiles,
        fetchBlob,
        commitChanges,
      });
    });

    test('exports all required service methods', () => {
      expect(gitlabBackend.isGit).toBe(true);
      expect(gitlabBackend.name).toBe('gitlab');
      expect(gitlabBackend.label).toBe('GitLab');
      expect(typeof gitlabBackend.checkStatus).toBe('function');
      expect(typeof gitlabBackend.init).toBe('function');
      expect(typeof gitlabBackend.signIn).toBe('function');
      expect(typeof gitlabBackend.signOut).toBe('function');
      expect(typeof gitlabBackend.fetchFiles).toBe('function');
      expect(typeof gitlabBackend.fetchBlob).toBe('function');
      expect(typeof gitlabBackend.commitChanges).toBe('function');
    });
  });
});
