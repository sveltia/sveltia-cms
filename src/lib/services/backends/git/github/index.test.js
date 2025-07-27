import { get } from 'svelte/store';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import githubBackend, { init } from '$lib/services/backends/git/github';
import {
  BACKEND_LABEL,
  BACKEND_NAME,
  DEFAULT_API_ROOT,
  DEFAULT_AUTH_PATH,
  DEFAULT_AUTH_ROOT,
  DEFAULT_ORIGIN,
} from '$lib/services/backends/git/github/constants';
import { repository } from '$lib/services/backends/git/github/repository';
import { apiConfig, graphqlVars } from '$lib/services/backends/git/shared/api';

// Mock dependencies
vi.mock('svelte/store', () => ({
  get: vi.fn(),
  writable: vi.fn(() => ({ subscribe: vi.fn(), set: vi.fn(), update: vi.fn() })),
  derived: vi.fn(() => ({ subscribe: vi.fn() })),
}));
vi.mock('$lib/services/config', () => ({
  siteConfig: { subscribe: vi.fn() },
}));
vi.mock('$lib/services/user/prefs', () => ({
  prefs: { subscribe: vi.fn() },
}));
vi.mock('$lib/services/user', () => ({
  user: { subscribe: vi.fn() },
}));
vi.mock('svelte-i18n', () => ({
  _: { subscribe: vi.fn() },
}));
vi.mock('$lib/services/backends/git/github/auth', () => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock('$lib/services/backends/git/github/commits', () => ({
  commitChanges: vi.fn(),
}));
vi.mock('$lib/services/backends/git/github/deployment', () => ({
  triggerDeployment: vi.fn(),
}));
vi.mock('$lib/services/backends/git/github/files', () => ({
  fetchFiles: vi.fn(),
  fetchBlob: vi.fn(),
}));
vi.mock('$lib/services/backends/git/github/repository', () => ({
  repository: {},
  getBaseURLs: vi.fn(() => ({})),
}));
vi.mock('$lib/services/backends/git/github/status', () => ({
  checkStatus: vi.fn(),
  STATUS_DASHBOARD_URL: 'https://www.githubstatus.com',
}));
vi.mock('$lib/services/backends/git/shared/api', () => ({
  apiConfig: {},
  graphqlVars: {},
}));

describe('GitHub backend service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock Object.assign used in the init function
    vi.spyOn(Object, 'assign').mockImplementation(() => ({}));
  });

  test('exports correct service structure', () => {
    expect(githubBackend).toEqual({
      isGit: true,
      name: BACKEND_NAME,
      label: BACKEND_LABEL,
      repository,
      statusDashboardURL: 'https://www.githubstatus.com',
      checkStatus: expect.any(Function),
      init: expect.any(Function),
      signIn: expect.any(Function),
      signOut: expect.any(Function),
      fetchFiles: expect.any(Function),
      fetchBlob: expect.any(Function),
      commitChanges: expect.any(Function),
      triggerDeployment: expect.any(Function),
    });
  });

  describe('init', () => {
    test('returns undefined when siteConfig is undefined', () => {
      vi.mocked(get).mockReturnValue(undefined);

      const result = init();

      expect(result).toBeUndefined();
    });

    test('returns undefined when backend is not GitHub', () => {
      vi.mocked(get).mockReturnValue({ backend: { name: 'other' } });

      const result = init();

      expect(result).toBeUndefined();
    });

    test('initializes with default configuration', () => {
      const mockSiteConfig = {
        backend: {
          name: BACKEND_NAME,
          repo: 'owner/repo',
          branch: 'main',
        },
      };

      const mockPrefs = { devModeEnabled: false };

      vi.mocked(get).mockReturnValueOnce(mockSiteConfig).mockReturnValueOnce(mockPrefs);

      const result = init();

      expect(Object.assign).toHaveBeenCalledWith(
        repository,
        expect.objectContaining({
          service: BACKEND_NAME,
          label: BACKEND_LABEL,
          owner: 'owner',
          repo: 'repo',
          branch: 'main',
          baseURL: `${DEFAULT_ORIGIN}/owner/repo`,
          databaseName: `${BACKEND_NAME}:owner/repo`,
          isSelfHosted: false,
        }),
        expect.any(Object),
      );

      expect(Object.assign).toHaveBeenCalledWith(
        apiConfig,
        expect.objectContaining({
          clientId: '',
          authURL: `${DEFAULT_AUTH_ROOT}/${DEFAULT_AUTH_PATH}`,
          tokenURL: `${DEFAULT_AUTH_ROOT}/${DEFAULT_AUTH_PATH}`,
          origin: new URL(DEFAULT_API_ROOT).origin,
          restBaseURL: DEFAULT_API_ROOT,
          graphqlBaseURL: DEFAULT_API_ROOT,
        }),
      );

      expect(Object.assign).toHaveBeenCalledWith(graphqlVars, {
        owner: 'owner',
        repo: 'repo',
        branch: 'main',
      });

      expect(result).toBe(repository);
    });

    test('initializes with custom configuration', () => {
      const customAuthRoot = 'https://custom-auth.example.com';
      const customAuthPath = 'custom/auth';
      const customApiRoot = 'https://api.custom.com';
      const customGraphqlRoot = 'https://graphql.custom.com';

      const mockSiteConfig = {
        backend: {
          name: BACKEND_NAME,
          repo: 'owner/repo',
          branch: 'develop',
          base_url: customAuthRoot,
          auth_endpoint: customAuthPath,
          api_root: customApiRoot,
          graphql_api_root: customGraphqlRoot,
        },
      };

      const mockPrefs = { devModeEnabled: false };

      vi.mocked(get).mockReturnValueOnce(mockSiteConfig).mockReturnValueOnce(mockPrefs);

      const result = init();

      expect(Object.assign).toHaveBeenCalledWith(
        repository,
        expect.objectContaining({
          service: BACKEND_NAME,
          label: BACKEND_LABEL,
          owner: 'owner',
          repo: 'repo',
          branch: 'develop',
          baseURL: 'https://api.custom.com/owner/repo',
          databaseName: `${BACKEND_NAME}:owner/repo`,
          isSelfHosted: true,
        }),
        expect.any(Object),
      );

      expect(Object.assign).toHaveBeenCalledWith(
        apiConfig,
        expect.objectContaining({
          clientId: '',
          authURL: `${customAuthRoot}/${customAuthPath}`,
          tokenURL: `${customAuthRoot}/${customAuthPath}`,
          origin: 'https://api.custom.com',
          restBaseURL: 'https://api.custom.com/api/v3',
          graphqlBaseURL: 'https://graphql.custom.com/api',
        }),
      );

      expect(result).toBe(repository);
    });

    test('logs repository info in dev mode', () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      const mockSiteConfig = {
        backend: {
          name: BACKEND_NAME,
          repo: 'owner/repo',
          branch: 'main',
        },
      };

      const mockPrefs = { devModeEnabled: true };

      vi.mocked(get).mockReturnValueOnce(mockSiteConfig).mockReturnValueOnce(mockPrefs);

      init();

      expect(consoleSpy).toHaveBeenCalledWith('repositoryInfo', repository);

      consoleSpy.mockRestore();
    });

    test('handles repository path with trailing slash', () => {
      const mockSiteConfig = {
        backend: {
          name: BACKEND_NAME,
          repo: 'owner/repo/',
          branch: 'main',
        },
      };

      const mockPrefs = { devModeEnabled: false };

      vi.mocked(get).mockReturnValueOnce(mockSiteConfig).mockReturnValueOnce(mockPrefs);

      init();

      expect(Object.assign).toHaveBeenCalledWith(
        repository,
        expect.objectContaining({
          owner: 'owner',
          repo: 'repo',
        }),
        expect.any(Object),
      );
    });
  });
});
