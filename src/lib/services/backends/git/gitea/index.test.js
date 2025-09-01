import { beforeEach, describe, expect, test, vi } from 'vitest';

// Mock dependencies with vi.hoisted to ensure proper hoisting
const getMock = vi.hoisted(() => vi.fn());
const stripSlashesMock = vi.hoisted(() => vi.fn());

vi.mock('svelte/store', () => ({
  get: getMock,
}));

vi.mock('@sveltia/utils/string', () => ({
  stripSlashes: stripSlashesMock,
}));

vi.mock('$lib/services/backends/git/gitea/auth', () => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('$lib/services/backends/git/gitea/commits', () => ({
  commitChanges: vi.fn(),
}));

vi.mock('$lib/services/backends/git/gitea/constants', () => ({
  BACKEND_LABEL: 'Gitea',
  BACKEND_NAME: 'gitea',
  DEFAULT_API_ROOT: 'https://gitea.com/api/v1',
  DEFAULT_AUTH_PATH: 'login/oauth/authorize',
  DEFAULT_AUTH_ROOT: 'https://gitea.com',
}));

vi.mock('$lib/services/backends/git/gitea/files', () => ({
  fetchBlob: vi.fn(),
  fetchFiles: vi.fn(),
}));

vi.mock('$lib/services/backends/git/gitea/repository', () => ({
  repository: {},
  getBaseURLs: vi.fn(() => ({ treeBaseURL: 'tree-url', blobBaseURL: 'blob-url' })),
  getPatURL: vi.fn(),
}));

vi.mock('$lib/services/backends/git/shared/api', () => ({
  apiConfig: {},
}));

vi.mock('$lib/services/config', () => ({
  siteConfig: { mockStore: 'siteConfig' },
}));

vi.mock('$lib/services/user/prefs', () => ({
  prefs: { mockStore: 'prefs' },
}));

// Import after mocks
const { init } = await import('./index.js');
const { getPatURL } = await import('./repository.js');

describe('Gitea Index Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks
    stripSlashesMock.mockImplementation((/** @type {string} */ str) =>
      str.replace(/^\/+|\/+$/g, ''),
    );

    // Mock getPatURL dynamically based on the input
    vi.mocked(getPatURL).mockImplementation((repoURL) => {
      const { origin } = new URL(repoURL);

      return `${origin}/user/settings/applications`;
    });

    // Default mock setup for stores
    getMock.mockImplementation((/** @type {any} */ store) => {
      if (store && typeof store === 'object' && store.mockStore === 'siteConfig') {
        return {
          backend: {
            name: 'gitea',
            repo: 'owner/repo-name',
            branch: 'main',
            base_url: 'https://gitea.com',
            auth_endpoint: 'login/oauth/authorize',
            app_id: 'test-client-id',
            api_root: 'https://gitea.com/api/v1',
          },
        };
      }

      if (store && typeof store === 'object' && store.mockStore === 'prefs') {
        return { devModeEnabled: false };
      }

      return {};
    });
  });

  describe('init', () => {
    test('should initialize Gitea backend with default configuration', () => {
      const result = init();

      expect(result).toBeDefined();
      expect(result?.service).toBe('gitea');
      expect(result?.owner).toBe('owner');
      expect(result?.repo).toBe('repo-name');
      expect(stripSlashesMock).toHaveBeenCalledWith('https://gitea.com');
      expect(stripSlashesMock).toHaveBeenCalledWith('login/oauth/authorize');
    });

    test('should set repository object with complete configuration including newPatURL', () => {
      const result = init();

      expect(result).toEqual(
        expect.objectContaining({
          service: 'gitea',
          label: 'Gitea',
          owner: 'owner',
          repo: 'repo-name',
          branch: 'main',
          repoURL: 'https://gitea.com/owner/repo-name',
          newPatURL: 'https://gitea.com/user/settings/applications',
          databaseName: 'gitea:owner/repo-name',
          isSelfHosted: false,
          treeBaseURL: 'tree-url',
          blobBaseURL: 'blob-url',
        }),
      );
    });

    test('should return undefined when backend is not Gitea', () => {
      getMock.mockImplementation((/** @type {any} */ store) => {
        if (store && typeof store === 'object' && store.mockStore === 'siteConfig') {
          return {
            backend: {
              name: 'github', // Different backend
            },
          };
        }

        return {};
      });

      const result = init();

      expect(result).toBeUndefined();
    });

    test('should return undefined when no backend is configured', () => {
      getMock.mockImplementation((/** @type {any} */ store) => {
        if (store && typeof store === 'object' && store.mockStore === 'siteConfig') {
          return {}; // No backend configured
        }

        return {};
      });

      const result = init();

      expect(result).toBeUndefined();
    });

    test('should return undefined when siteConfig is null', () => {
      getMock.mockImplementation(() => null);

      const result = init();

      expect(result).toBeUndefined();
    });

    test('should handle custom configuration values', () => {
      getMock.mockImplementation((/** @type {any} */ store) => {
        if (store && typeof store === 'object' && store.mockStore === 'siteConfig') {
          return {
            backend: {
              name: 'gitea',
              repo: 'custom-owner/custom-repo',
              branch: 'develop',
              base_url: 'https://custom-gitea.com',
              auth_endpoint: 'custom/oauth/authorize',
              app_id: 'custom-client-id',
              api_root: 'https://custom-api.gitea.com',
            },
          };
        }

        if (store && typeof store === 'object' && store.mockStore === 'prefs') {
          return { devModeEnabled: false };
        }

        return {};
      });

      const result = init();

      expect(result).toBeDefined();
      expect(result?.owner).toBe('custom-owner');
      expect(result?.repo).toBe('custom-repo');
      expect(stripSlashesMock).toHaveBeenCalledWith('https://custom-gitea.com');
      expect(stripSlashesMock).toHaveBeenCalledWith('custom/oauth/authorize');
    });

    test('should set newPatURL correctly for custom Gitea instances', () => {
      getMock.mockImplementation((/** @type {any} */ store) => {
        if (store && typeof store === 'object' && store.mockStore === 'siteConfig') {
          return {
            backend: {
              name: 'gitea',
              repo: 'custom-owner/custom-repo',
              branch: 'develop',
              base_url: 'https://custom-gitea.com',
              auth_endpoint: 'custom/oauth/authorize',
              app_id: 'custom-client-id',
              api_root: 'https://custom-api.gitea.com',
            },
          };
        }

        if (store && typeof store === 'object' && store.mockStore === 'prefs') {
          return { devModeEnabled: false };
        }

        return {};
      });

      const result = init();

      expect(result).toEqual(
        expect.objectContaining({
          service: 'gitea',
          label: 'Gitea',
          owner: 'custom-owner',
          repo: 'custom-repo',
          branch: 'develop',
          repoURL: 'https://custom-api.gitea.com/custom-owner/custom-repo',
          newPatURL: 'https://custom-api.gitea.com/user/settings/applications',
          databaseName: 'gitea:custom-owner/custom-repo',
          isSelfHosted: true,
          treeBaseURL: 'tree-url',
          blobBaseURL: 'blob-url',
        }),
      );
    });

    test('should use default values for missing optional configuration', () => {
      getMock.mockImplementation((/** @type {any} */ store) => {
        if (store && typeof store === 'object' && store.mockStore === 'siteConfig') {
          return {
            backend: {
              name: 'gitea',
              repo: 'test-org/test-repository',
              branch: 'main',
              // Missing base_url, auth_endpoint, app_id, api_root - should use defaults
            },
          };
        }

        if (store && typeof store === 'object' && store.mockStore === 'prefs') {
          return { devModeEnabled: false };
        }

        return {};
      });

      const result = init();

      expect(result).toBeDefined();
      expect(stripSlashesMock).toHaveBeenCalledWith('https://gitea.com');
      expect(stripSlashesMock).toHaveBeenCalledWith('login/oauth/authorize');
    });

    test('should detect self-hosted instances correctly', () => {
      getMock.mockImplementation((/** @type {any} */ store) => {
        if (store && typeof store === 'object' && store.mockStore === 'siteConfig') {
          return {
            backend: {
              name: 'gitea',
              repo: 'self-hosted/project',
              api_root: 'https://my-gitea.company.com',
            },
          };
        }

        if (store && typeof store === 'object' && store.mockStore === 'prefs') {
          return { devModeEnabled: false };
        }

        return {};
      });

      const result = init();

      expect(result).toBeDefined();
      expect(result?.isSelfHosted).toBe(true);
    });

    test('should handle dev mode logging', () => {
      const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      getMock.mockImplementation((/** @type {any} */ store) => {
        if (store && typeof store === 'object' && store.mockStore === 'siteConfig') {
          return {
            backend: {
              name: 'gitea',
              repo: 'test/repo',
            },
          };
        }

        if (store && typeof store === 'object' && store.mockStore === 'prefs') {
          return { devModeEnabled: true };
        }

        return {};
      });

      const result = init();

      expect(result).toBeDefined();
      expect(consoleInfoSpy).toHaveBeenCalledWith('repositoryInfo', expect.any(Object));

      consoleInfoSpy.mockRestore();
    });
  });

  describe('default export', () => {
    test('should export BackendService with correct properties', async () => {
      const { default: backend } = await import('./index.js');

      expect(backend).toBeDefined();
      expect(backend.isGit).toBe(true);
      expect(backend.name).toBe('gitea');
      expect(backend.label).toBe('Gitea');
      expect(backend.repository).toBeDefined();
      expect(backend.init).toBe(init);
      expect(typeof backend.signIn).toBe('function');
      expect(typeof backend.signOut).toBe('function');
      expect(typeof backend.fetchFiles).toBe('function');
      expect(typeof backend.fetchBlob).toBe('function');
      expect(typeof backend.commitChanges).toBe('function');
    });
  });
});
