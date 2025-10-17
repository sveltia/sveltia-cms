import { init as initI18n } from 'svelte-i18n';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEV_SITE_URL, siteConfig, siteConfigError, siteConfigVersion, validate } from './index.js';

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

  describe('validate', () => {
    it('should accept valid config', () => {
      const validConfig = {
        // @ts-ignore - simplified config for testing
        backend: { name: 'git-gateway' },
        media_folder: 'uploads',
        collections: [{ name: 'posts', folder: '_posts' }],
      };

      // @ts-ignore - testing with simplified config
      expect(() => validate(validConfig)).not.toThrow();
    });

    it('should reject empty config', () => {
      // @ts-ignore - testing invalid config
      expect(() => validate({})).toThrow();
    });

    it('should reject config without required fields', () => {
      // @ts-ignore - testing invalid config
      expect(() => validate({ collections: [] })).toThrow();
    });

    it('should reject config without collections or singletons', () => {
      expect(() =>
        // @ts-ignore - testing invalid config
        validate({ backend: { name: 'github' }, media_folder: 'uploads' }),
      ).toThrow();
    });

    it('should reject config without backend', () => {
      expect(() =>
        // @ts-ignore - testing invalid config
        validate({ media_folder: 'uploads', collections: [] }),
      ).toThrow();
    });

    it('should reject config without backend name', () => {
      expect(() =>
        // @ts-ignore - testing invalid config
        validate({ backend: {}, media_folder: 'uploads', collections: [] }),
      ).toThrow();
    });

    it('should reject config with unsupported backend', () => {
      expect(() =>
        // @ts-ignore - testing invalid config
        validate({ backend: { name: 'unsupported' }, media_folder: 'uploads', collections: [] }),
      ).toThrow();
    });

    it('should reject GitHub backend without repo', () => {
      expect(() =>
        // @ts-ignore - testing invalid config
        validate({ backend: { name: 'github' }, media_folder: 'uploads', collections: [] }),
      ).toThrow();
    });

    it('should reject GitHub backend with invalid repo format', () => {
      expect(() =>
        // @ts-ignore - testing invalid config
        validate({
          backend: { name: 'github', repo: 'invalid' },
          media_folder: 'uploads',
          collections: [],
        }),
      ).toThrow();
    });

    it('should accept GitHub backend with valid repo', () => {
      expect(() =>
        // @ts-ignore - testing invalid config
        validate({
          backend: { name: 'github', repo: 'owner/repo' },
          media_folder: 'uploads',
          collections: [],
        }),
      ).not.toThrow();
    });

    it('should reject GitLab backend with implicit auth', () => {
      expect(() =>
        // @ts-ignore - testing invalid config
        validate({
          backend: { name: 'gitlab', repo: 'owner/repo', auth_type: 'implicit' },
          media_folder: 'uploads',
          collections: [],
        }),
      ).toThrow();
    });

    it('should reject GitLab backend with PKCE auth but no app_id', () => {
      expect(() =>
        // @ts-ignore - testing invalid config
        validate({
          backend: { name: 'gitlab', repo: 'owner/repo', auth_type: 'pkce' },
          media_folder: 'uploads',
          collections: [],
        }),
      ).toThrow();
    });

    it('should accept GitLab backend with PKCE auth and app_id', () => {
      expect(() =>
        // @ts-ignore - testing invalid config
        validate({
          backend: { name: 'gitlab', repo: 'owner/repo', auth_type: 'pkce', app_id: 'test-app-id' },
          media_folder: 'uploads',
          collections: [],
        }),
      ).not.toThrow();
    });

    it('should reject Gitea backend without app_id', () => {
      expect(() =>
        validate(
          /** @type {any} */ ({
            backend: { name: 'gitea', repo: 'owner/repo' },
            media_folder: 'uploads',
            collections: [],
          }),
        ),
      ).toThrow();
    });

    it('should accept Gitea backend with app_id', () => {
      expect(() =>
        // @ts-ignore - testing invalid config
        validate({
          backend: { name: 'gitea', repo: 'owner/repo', app_id: 'test-app-id' },
          media_folder: 'uploads',
          collections: [],
        }),
      ).not.toThrow();
    });

    it('should reject config without media_folder', () => {
      expect(() =>
        // @ts-ignore - testing invalid config
        validate({ backend: { name: 'git-gateway' }, collections: [] }),
      ).toThrow();
    });

    it('should accept config without media_folder when using external media_library', () => {
      expect(() =>
        validate(
          /** @type {any} */ ({
            backend: { name: 'git-gateway' },
            collections: [],
            media_library: { name: 'uploadcare' },
          }),
        ),
      ).not.toThrow();
    });

    it('should reject config without media_folder when using stock_assets media_library', () => {
      expect(() =>
        validate(
          /** @type {any} */ ({
            backend: { name: 'git-gateway' },
            collections: [],
            media_library: { name: 'stock_assets' },
          }),
        ),
      ).toThrow();
    });

    it('should accept config without media_folder when using external media_libraries', () => {
      expect(() =>
        validate(
          /** @type {any} */ ({
            backend: { name: 'git-gateway' },
            collections: [],
            media_libraries: { uploadcare: { public_key: 'test' } },
          }),
        ),
      ).not.toThrow();
    });

    it('should reject config without media_folder when using stock_assets media_libraries', () => {
      expect(() =>
        validate(
          /** @type {any} */ ({
            backend: { name: 'git-gateway' },
            collections: [],
            media_libraries: { stock_assets: {} },
          }),
        ),
      ).toThrow();
    });

    it('should reject config without media_folder when using non-external media library', () => {
      expect(() =>
        validate(
          /** @type {any} */ ({
            backend: { name: 'git-gateway' },
            collections: [],
            media_library: { name: 'unknown' },
          }),
        ),
      ).toThrow();
    });

    it('should reject config without media_folder when using multiple non-external media_libraries', () => {
      expect(() =>
        validate(
          /** @type {any} */ ({
            backend: { name: 'git-gateway' },
            collections: [],
            media_libraries: { custom: {} },
          }),
        ),
      ).toThrow();
    });

    it('should accept config without media_folder when at least one external media library is present', () => {
      expect(() =>
        validate(
          /** @type {any} */ ({
            backend: { name: 'git-gateway' },
            collections: [],
            media_libraries: { uploadcare: { public_key: 'test' }, custom: {} },
          }),
        ),
      ).not.toThrow();
    });

    it('should reject config with non-string media_folder', () => {
      expect(() =>
        // @ts-ignore - testing invalid config
        validate({ backend: { name: 'git-gateway' }, media_folder: 123, collections: [] }),
      ).toThrow();
    });

    it('should reject config with non-string public_folder', () => {
      expect(() =>
        validate(
          /** @type {any} */ ({
            backend: { name: 'git-gateway' },
            media_folder: 'uploads',
            public_folder: 123,
            collections: [],
          }),
        ),
      ).toThrow();
    });

    it('should reject config with relative public_folder path', () => {
      expect(() =>
        validate(
          /** @type {any} */ ({
            backend: { name: 'git-gateway' },
            media_folder: 'uploads',
            public_folder: '../images',
            collections: [],
          }),
        ),
      ).toThrow();
    });

    it('should reject config with absolute URL in public_folder', () => {
      expect(() =>
        validate(
          /** @type {any} */ ({
            backend: { name: 'git-gateway' },
            media_folder: 'uploads',
            public_folder: 'https://example.com/images',
            collections: [],
          }),
        ),
      ).toThrow();
    });

    it('should accept singletons instead of collections', () => {
      expect(() =>
        validate(
          /** @type {any} */ ({
            backend: { name: 'git-gateway' },
            media_folder: 'uploads',
            singletons: [{ name: 'config' }],
          }),
        ),
      ).not.toThrow();
    });
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

  describe('validate - additional edge cases', () => {
    it('should warn about editorial workflow', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      validate(
        /** @type {any} */ ({
          backend: { name: 'git-gateway' },
          media_folder: 'uploads',
          collections: [],
          publish_mode: 'editorial_workflow',
        }),
      );

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Editorial workflow is not yet supported in Sveltia CMS.',
      );

      consoleWarnSpy.mockRestore();
    });

    it('should warn about GitHub open authoring', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      validate(
        /** @type {any} */ ({
          backend: { name: 'github', repo: 'owner/repo', open_authoring: true },
          media_folder: 'uploads',
          collections: [],
        }),
      );

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Open authoring is not yet supported in Sveltia CMS.',
      );

      consoleWarnSpy.mockRestore();
    });

    it('should warn about nested collections', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      validate(
        /** @type {any} */ ({
          backend: { name: 'git-gateway' },
          media_folder: 'uploads',
          collections: [{ name: 'posts', folder: '_posts', nested: { depth: 3 } }],
        }),
      );

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Nested collections are not yet supported in Sveltia CMS.',
      );

      consoleWarnSpy.mockRestore();
    });

    it('should warn about Cloudinary media library', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      validate(
        /** @type {any} */ ({
          backend: { name: 'git-gateway' },
          media_folder: 'uploads',
          collections: [],
          media_library: { name: 'cloudinary' },
        }),
      );

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Cloudinary media library is not yet supported in Sveltia CMS.',
      );

      consoleWarnSpy.mockRestore();
    });

    it('should warn about Cloudinary in media_libraries', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      validate(
        /** @type {any} */ ({
          backend: { name: 'git-gateway' },
          media_folder: 'uploads',
          collections: [],
          media_libraries: { cloudinary: { cloud_name: 'test' } },
        }),
      );

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Cloudinary media library is not yet supported in Sveltia CMS.',
      );

      consoleWarnSpy.mockRestore();
    });

    it('should accept valid public_folder as absolute path', () => {
      expect(() =>
        validate(
          /** @type {any} */ ({
            backend: { name: 'git-gateway' },
            media_folder: 'uploads',
            public_folder: '/images',
            collections: [],
          }),
        ),
      ).not.toThrow();
    });

    it('should reject relative path starting with ./ in public_folder', () => {
      expect(() =>
        validate(
          /** @type {any} */ ({
            backend: { name: 'git-gateway' },
            media_folder: 'uploads',
            public_folder: './images',
            collections: [],
          }),
        ),
      ).toThrow();
    });

    it('should reject relative path starting with ../ in public_folder', () => {
      expect(() =>
        validate(
          /** @type {any} */ ({
            backend: { name: 'git-gateway' },
            media_folder: 'uploads',
            public_folder: '../images',
            collections: [],
          }),
        ),
      ).toThrow();
    });

    it('should reject absolute URL in public_folder', () => {
      expect(() =>
        validate(
          /** @type {any} */ ({
            backend: { name: 'git-gateway' },
            media_folder: 'uploads',
            public_folder: 'https://example.com/images',
            collections: [],
          }),
        ),
      ).toThrow();
    });

    it('should reject http URL in public_folder', () => {
      expect(() =>
        validate(
          /** @type {any} */ ({
            backend: { name: 'git-gateway' },
            media_folder: 'uploads',
            public_folder: 'http://example.com/images',
            collections: [],
          }),
        ),
      ).toThrow();
    });

    it('should accept missing public_folder', () => {
      expect(() =>
        validate(
          /** @type {any} */ ({
            backend: { name: 'git-gateway' },
            media_folder: 'uploads',
            collections: [],
          }),
        ),
      ).not.toThrow();
    });

    it('should warn about open authoring', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      validate(
        /** @type {any} */ ({
          backend: { name: 'github', repo: 'test/repo', open_authoring: true },
          media_folder: 'uploads',
          collections: [],
        }),
      );

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Open authoring is not yet supported in Sveltia CMS.',
      );

      consoleWarnSpy.mockRestore();
    });

    it('should warn about nested collections', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      validate(
        /** @type {any} */ ({
          backend: { name: 'git-gateway' },
          media_folder: 'uploads',
          collections: [{ name: 'posts', folder: '_posts', nested: { depth: 2 } }],
        }),
      );

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Nested collections are not yet supported in Sveltia CMS.',
      );

      consoleWarnSpy.mockRestore();
    });

    it('should accept config with singletons', () => {
      expect(() =>
        validate(
          /** @type {any} */ ({
            backend: { name: 'git-gateway' },
            media_folder: 'uploads',
            singletons: [{ name: 'about', file: 'about.md' }],
          }),
        ),
      ).not.toThrow();
    });

    it('should accept config with both collections and singletons', () => {
      expect(() =>
        validate(
          /** @type {any} */ ({
            backend: { name: 'git-gateway' },
            media_folder: 'uploads',
            collections: [{ name: 'posts', folder: '_posts' }],
            singletons: [{ name: 'about', file: 'about.md' }],
          }),
        ),
      ).not.toThrow();
    });

    it('should warn about deprecated automatic_deployments option', async () => {
      const { warnDeprecation: mockWarnDeprecation } = await import(
        '$lib/services/config/deprecations'
      );

      validate(
        /** @type {any} */ ({
          backend: {
            name: 'github',
            repo: 'owner/repo',
            automatic_deployments: true,
          },
          media_folder: 'uploads',
          collections: [],
        }),
      );

      expect(mockWarnDeprecation).toHaveBeenCalledWith('automatic_deployments');
    });

    it('should accept undefined media_folder with cloudinary in media_library', () => {
      expect(() =>
        validate(
          /** @type {any} */ ({
            backend: { name: 'git-gateway' },
            collections: [],
            media_library: { name: 'cloudinary' },
          }),
        ),
      ).not.toThrow();
    });

    it('should accept undefined media_folder with cloudinary in media_libraries', () => {
      expect(() =>
        validate(
          /** @type {any} */ ({
            backend: { name: 'git-gateway' },
            collections: [],
            media_libraries: { cloudinary: { cloud_name: 'test' } },
          }),
        ),
      ).not.toThrow();
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
