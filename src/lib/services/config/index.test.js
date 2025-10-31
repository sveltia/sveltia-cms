import { init as initI18n } from 'svelte-i18n';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEV_SITE_URL, siteConfig, siteConfigError, siteConfigVersion } from './index.js';

// Mock external dependencies
vi.mock('@sveltia/utils/crypto', () => ({
  getHash: vi.fn().mockResolvedValue('mock-hash'),
}));

vi.mock('svelte/store', async () => {
  const actual = await vi.importActual('svelte/store');

  return {
    ...actual,
    get: vi.fn((store) => {
      // Handle the i18n _ store
      if (store && typeof store === 'function') {
        // Return a mock translation function
        return (/** @type {string} */ key) => key;
      }

      // Default mock behavior for other stores
      return { devModeEnabled: false };
    }),
  };
});

vi.mock('$lib/services/config/loader', () => ({
  fetchSiteConfig: vi.fn(),
}));

vi.mock('$lib/services/config/deprecations', () => ({
  warnDeprecation: vi.fn(),
}));

vi.mock('$lib/services/config/folders/assets', () => ({
  getAllAssetFolders: vi.fn().mockReturnValue([]),
}));

vi.mock('$lib/services/config/folders/entries', () => ({
  getAllEntryFolders: vi.fn().mockReturnValue([]),
}));

vi.mock('$lib/services/assets/folders', () => ({
  allAssetFolders: { set: vi.fn() },
  selectedAssetFolder: { subscribe: vi.fn() },
}));

vi.mock('$lib/services/contents', () => ({
  allEntryFolders: { set: vi.fn() },
}));

vi.mock('$lib/services/user/prefs', () => ({
  prefs: {
    subscribe: vi.fn(() => () => {}),
  },
}));

vi.mock('$lib/services/backends', () => ({
  initBackend: vi.fn(),
  validBackendNames: ['git-gateway', 'github', 'gitlab', 'gitea'],
  gitBackendServices: {
    github: {},
    gitlab: {},
    gitea: {},
  },
}));

// Mock i18n
vi.mock('svelte-i18n', () => ({
  init: vi.fn().mockResolvedValue({}),
  _: vi.fn(),
}));

describe('config/index', () => {
  beforeEach(async () => {
    // Initialize i18n for tests
    await initI18n({
      fallbackLocale: 'en',
      initialLocale: 'en',
    });

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Reset stores
    siteConfig.set(undefined);
    siteConfigError.set(undefined);
    siteConfigVersion.set('0');
  });

  describe('constants', () => {
    it('should have DEV_SITE_URL constant', () => {
      // The actual URL depends on the environment, just check it's a localhost URL
      expect(DEV_SITE_URL).toMatch(/^https?:\/\/localhost:\d+$/);
    });
  });

  describe('stores', () => {
    it('should export config stores', () => {
      expect(siteConfig).toBeDefined();
      expect(siteConfigError).toBeDefined();
      expect(siteConfigVersion).toBeDefined();
    });
  });

  describe('initSiteConfig', () => {
    /** @type {any} */
    let fetchSiteConfigMock;
    /** @type {any} */
    let getHashMock;
    /** @type {any} */
    let originalIsSecureContext;
    /** @type {any} */
    let originalLocation;

    beforeEach(async () => {
      const { fetchSiteConfig } = await import('$lib/services/config/loader');
      const { getHash } = await import('@sveltia/utils/crypto');

      fetchSiteConfigMock = vi.mocked(fetchSiteConfig);
      getHashMock = vi.mocked(getHash);

      // Mock window if not defined
      // @ts-ignore - window may not be defined in Node test environment
      if (typeof window === 'undefined') {
        global.window = /** @type {any} */ ({
          isSecureContext: true,
          location: { origin: 'http://localhost:3000' },
        });
        originalIsSecureContext = true;
        originalLocation = global.window.location;
      } else {
        // @ts-ignore - window may not be defined in Node test environment
        originalIsSecureContext = window.isSecureContext;
        // @ts-ignore - window may not be defined in Node test environment
        originalLocation = window.location;
        // @ts-ignore - window may not be defined in Node test environment
        Object.defineProperty(window, 'isSecureContext', { value: true, writable: true });
      }
    });

    afterEach(() => {
      // @ts-ignore - window may not be defined in Node test environment
      if (typeof window !== 'undefined') {
        // @ts-ignore - window may not be defined in Node test environment
        Object.defineProperty(window, 'isSecureContext', {
          value: originalIsSecureContext,
          writable: true,
        });

        if (originalLocation) {
          // @ts-ignore - window may not be defined in Node test environment
          Object.defineProperty(window, 'location', {
            value: originalLocation,
            writable: true,
          });
        }
      }
    });

    it('should throw error when not in secure context', async () => {
      const { initSiteConfig } = await import('./index.js');

      if (typeof window !== 'undefined') {
        Object.defineProperty(window, 'isSecureContext', { value: false, writable: true });
      } else {
        global.window.isSecureContext = false;
      }

      await initSiteConfig();

      const error = await new Promise((resolve) => {
        /* eslint-disable prefer-const */
        /** @type {() => void} */
        let unsubscribe;

        unsubscribe = siteConfigError.subscribe((err) => {
          if (err) {
            unsubscribe?.();
            resolve(err);
          }
        });
      });

      expect(error).toBeDefined();
      expect(error?.message).toContain('config.error.no_secure_context');
    });

    it('should load config from file when no manual config provided', async () => {
      const { initSiteConfig } = await import('./index.js');

      const mockConfig = {
        backend: { name: 'github', repo: 'owner/repo' },
        media_folder: 'uploads',
        collections: [{ name: 'posts', label: 'Posts', folder: 'posts' }],
      };

      fetchSiteConfigMock.mockResolvedValue(mockConfig);
      getHashMock.mockResolvedValue('test-hash');

      await initSiteConfig();

      expect(fetchSiteConfigMock).toHaveBeenCalled();

      const config = await new Promise((resolve) => {
        /* eslint-disable prefer-const */
        /** @type {() => void} */
        let unsubscribe;

        unsubscribe = siteConfig.subscribe((cfg) => {
          if (cfg) {
            unsubscribe?.();
            resolve(cfg);
          }
        });
      });

      expect(config).toBeDefined();
      expect(config?.backend.name).toBe('github');
    });

    it('should use manual config when provided and load_config_file is false', async () => {
      const { initSiteConfig } = await import('./index.js');

      /** @type {any} */
      const manualConfig = {
        backend: { name: 'github', repo: 'owner/repo' },
        media_folder: 'uploads',
        collections: [{ name: 'posts', label: 'Posts', folder: 'posts' }],
        load_config_file: false,
      };

      await initSiteConfig(manualConfig);

      expect(fetchSiteConfigMock).not.toHaveBeenCalled();

      const config = await new Promise((resolve) => {
        /* eslint-disable prefer-const */
        /** @type {() => void} */
        let unsubscribe;

        unsubscribe = siteConfig.subscribe((cfg) => {
          if (cfg) {
            unsubscribe?.();
            resolve(cfg);
          }
        });
      });

      expect(config).toBeDefined();
      expect(config?.backend.name).toBe('github');
    });

    it('should merge manual config with file config when load_config_file is not false', async () => {
      const { initSiteConfig } = await import('./index.js');

      const fileConfig = {
        backend: { name: 'github', repo: 'owner/repo' },
        media_folder: 'uploads',
        collections: [{ name: 'posts', label: 'Posts', folder: 'posts' }],
      };

      /** @type {any} */
      const manualConfig = {
        backend: { name: 'github', repo: 'different/repo' },
        site_url: 'https://example.com',
      };

      fetchSiteConfigMock.mockResolvedValue(fileConfig);

      await initSiteConfig(manualConfig);

      expect(fetchSiteConfigMock).toHaveBeenCalled();

      const config = await new Promise((resolve) => {
        /* eslint-disable prefer-const */
        /** @type {() => void} */
        let unsubscribe;

        unsubscribe = siteConfig.subscribe((cfg) => {
          if (cfg) {
            unsubscribe?.();
            resolve(cfg);
          }
        });
      });

      expect(config).toBeDefined();
      expect(config?.backend.repo).toBe('different/repo');
      expect(config?._siteURL).toBe('https://example.com');
    });

    it('should throw error when manual config is not an object', async () => {
      const { initSiteConfig } = await import('./index.js');

      await initSiteConfig(/** @type {any} */ ('not-an-object'));

      const error = await new Promise((resolve) => {
        /* eslint-disable prefer-const */
        /** @type {() => void} */
        let unsubscribe;

        unsubscribe = siteConfigError.subscribe((err) => {
          if (err) {
            unsubscribe?.();
            resolve(err);
          }
        });
      });

      expect(error).toBeDefined();
      expect(error?.message).toContain('config.error.parse_failed');
    });

    it('should set _siteURL from site_url config', async () => {
      const { initSiteConfig } = await import('./index.js');

      const mockConfig = {
        backend: { name: 'github', repo: 'owner/repo' },
        media_folder: 'uploads',
        collections: [{ name: 'posts', label: 'Posts', folder: 'posts' }],
        site_url: '  https://example.com  ',
      };

      fetchSiteConfigMock.mockResolvedValue(mockConfig);

      await initSiteConfig();

      const config = await new Promise((resolve) => {
        /* eslint-disable prefer-const */
        /** @type {() => void} */
        let unsubscribe;

        unsubscribe = siteConfig.subscribe((cfg) => {
          if (cfg) {
            unsubscribe?.();
            resolve(cfg);
          }
        });
      });

      expect(config?._siteURL).toBe('https://example.com');
      expect(config?._baseURL).toBe('https://example.com');
    });

    it('should use DEV_SITE_URL in development when site_url is not provided', async () => {
      const { initSiteConfig } = await import('./index.js');

      const mockConfig = {
        backend: { name: 'github', repo: 'owner/repo' },
        media_folder: 'uploads',
        collections: [{ name: 'posts', label: 'Posts', folder: 'posts' }],
      };

      fetchSiteConfigMock.mockResolvedValue(mockConfig);

      await initSiteConfig();

      const config = await new Promise((resolve) => {
        /* eslint-disable prefer-const */
        /** @type {() => void} */
        let unsubscribe;

        unsubscribe = siteConfig.subscribe((cfg) => {
          if (cfg) {
            unsubscribe?.();
            resolve(cfg);
          }
        });
      });

      // In test environment, DEV should be true
      expect(config?._siteURL).toBeDefined();
    });

    it('should set _baseURL to empty string for invalid URL (line 207)', async () => {
      const { initSiteConfig } = await import('./index.js');

      const mockConfig = {
        backend: { name: 'github', repo: 'owner/repo' },
        media_folder: 'uploads',
        collections: [{ name: 'posts', label: 'Posts', folder: 'posts' }],
        site_url: 'not-a-valid-url',
      };

      fetchSiteConfigMock.mockResolvedValue(mockConfig);

      await initSiteConfig();

      const config = await new Promise((resolve) => {
        /* eslint-disable prefer-const */
        /** @type {() => void} */
        let unsubscribe;

        unsubscribe = siteConfig.subscribe((cfg) => {
          if (cfg) {
            unsubscribe?.();
            resolve(cfg);
          }
        });
      });

      expect(config?._siteURL).toBe('not-a-valid-url');
      // When site_url is not a valid URL, _baseURL should be empty string
      expect(config?._baseURL).toBe('');
    });

    it('should handle root collection folder variants', async () => {
      const { initSiteConfig } = await import('./index.js');

      const mockConfig = {
        backend: { name: 'github', repo: 'owner/repo' },
        media_folder: 'uploads',
        collections: [
          { name: 'posts', label: 'Posts', folder: '.' },
          { name: 'pages', label: 'Pages', folder: '/' },
          { name: 'docs', label: 'Docs', folder: 'docs' },
        ],
      };

      fetchSiteConfigMock.mockResolvedValue(mockConfig);

      await initSiteConfig();

      const config = await new Promise((resolve) => {
        /* eslint-disable prefer-const */
        /** @type {() => void} */
        let unsubscribe;

        unsubscribe = siteConfig.subscribe((cfg) => {
          if (cfg) {
            unsubscribe?.();
            resolve(cfg);
          }
        });
      });

      expect(config?.collections?.[0].folder).toBe('');
      expect(config?.collections?.[1].folder).toBe('');
      expect(config?.collections?.[2].folder).toBe('docs');
    });

    it('should set siteConfigVersion with hash of config', async () => {
      const { initSiteConfig } = await import('./index.js');

      const mockConfig = {
        backend: { name: 'github', repo: 'owner/repo' },
        media_folder: 'uploads',
        collections: [{ name: 'posts', label: 'Posts', folder: 'posts' }],
      };

      fetchSiteConfigMock.mockResolvedValue(mockConfig);
      getHashMock.mockResolvedValue('config-hash-123');

      await initSiteConfig();

      // Wait for version to be set
      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });

      const version = await new Promise((resolve) => {
        /* eslint-disable prefer-const */
        /** @type {() => void} */
        let unsubscribe;

        unsubscribe = siteConfigVersion.subscribe((ver) => {
          if (ver && ver !== '0') {
            unsubscribe?.();
            resolve(ver);
          }
        });
      });

      expect(version).toBe('config-hash-123');
    });

    it('should handle validation errors', async () => {
      const { initSiteConfig } = await import('./index.js');

      const invalidConfig = {
        // Missing required fields
        backend: { name: 'github' },
      };

      fetchSiteConfigMock.mockResolvedValue(invalidConfig);

      await initSiteConfig();

      const error = await new Promise((resolve) => {
        /* eslint-disable prefer-const */
        /** @type {() => void} */
        let unsubscribe;

        unsubscribe = siteConfigError.subscribe((err) => {
          if (err) {
            unsubscribe?.();
            resolve(err);
          }
        });
      });

      expect(error).toBeDefined();
    });

    it('should handle unexpected errors with generic message', async () => {
      const { initSiteConfig } = await import('./index.js');

      fetchSiteConfigMock.mockRejectedValue(new TypeError('Network error'));

      await initSiteConfig();

      const error = await new Promise((resolve) => {
        /* eslint-disable prefer-const */
        /** @type {() => void} */
        let unsubscribe;

        unsubscribe = siteConfigError.subscribe((err) => {
          if (err) {
            unsubscribe?.();
            resolve(err);
          }
        });
      });

      expect(error).toBeDefined();
      expect(error?.message).toContain('config.error.unexpected');
    });
  });
});
