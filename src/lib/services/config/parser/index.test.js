import { init as initI18n } from 'svelte-i18n';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { siteConfig, siteConfigError, siteConfigVersion } from '../index.js';

import { parseSiteConfig } from './index.js';

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

  describe('parseSiteConfig', () => {
    it('should accept valid config', () => {
      const validConfig = {
        // @ts-ignore - simplified config for testing
        backend: { name: 'git-gateway' },
        media_folder: 'uploads',
        collections: [{ name: 'posts', folder: '_posts' }],
      };

      // @ts-ignore - testing with simplified config
      expect(() => parseSiteConfig(validConfig)).not.toThrow();
    });

    it('should reject empty config', () => {
      // @ts-ignore - testing invalid config
      expect(() => parseSiteConfig({})).toThrow();
    });

    it('should reject config without required fields', () => {
      // @ts-ignore - testing invalid config
      expect(() => parseSiteConfig({ collections: [] })).toThrow();
    });

    it('should reject config without collections or singletons', () => {
      expect(() =>
        // @ts-ignore - testing invalid config
        parseSiteConfig({ backend: { name: 'github' }, media_folder: 'uploads' }),
      ).toThrow();
    });

    it('should reject config without backend', () => {
      expect(() =>
        // @ts-ignore - testing invalid config
        parseSiteConfig({ media_folder: 'uploads', collections: [] }),
      ).toThrow();
    });

    it('should reject config without backend name', () => {
      expect(() =>
        // @ts-ignore - testing invalid config
        parseSiteConfig({ backend: {}, media_folder: 'uploads', collections: [] }),
      ).toThrow();
    });

    it('should reject config with unsupported backend', () => {
      expect(() =>
        parseSiteConfig({
          // @ts-ignore - testing invalid config
          backend: { name: 'unsupported' },
          media_folder: 'uploads',
          collections: [],
        }),
      ).toThrow();
    });

    it('should reject GitHub backend without repo', () => {
      expect(() =>
        // @ts-ignore - testing invalid config
        parseSiteConfig({ backend: { name: 'github' }, media_folder: 'uploads', collections: [] }),
      ).toThrow();
    });

    it('should reject GitHub backend with invalid repo format', () => {
      expect(() =>
        // @ts-ignore - testing invalid config
        parseSiteConfig({
          backend: { name: 'github', repo: 'invalid' },
          media_folder: 'uploads',
          collections: [],
        }),
      ).toThrow();
    });

    it('should accept GitHub backend with valid repo', () => {
      expect(() =>
        // @ts-ignore - testing invalid config
        parseSiteConfig({
          backend: { name: 'github', repo: 'owner/repo' },
          media_folder: 'uploads',
          collections: [],
        }),
      ).not.toThrow();
    });

    it('should reject GitLab backend with implicit auth', () => {
      expect(() =>
        // @ts-ignore - testing invalid config
        parseSiteConfig({
          // @ts-ignore `implicit` is not supported in Sveltia CMS
          backend: { name: 'gitlab', repo: 'owner/repo', auth_type: 'implicit' },
          media_folder: 'uploads',
          collections: [],
        }),
      ).toThrow();
    });

    it('should reject GitLab backend with PKCE auth but no app_id', () => {
      expect(() =>
        // @ts-ignore - testing invalid config
        parseSiteConfig({
          backend: { name: 'gitlab', repo: 'owner/repo', auth_type: 'pkce' },
          media_folder: 'uploads',
          collections: [],
        }),
      ).toThrow();
    });

    it('should accept GitLab backend with PKCE auth and app_id', () => {
      expect(() =>
        // @ts-ignore - testing invalid config
        parseSiteConfig({
          backend: { name: 'gitlab', repo: 'owner/repo', auth_type: 'pkce', app_id: 'test-app-id' },
          media_folder: 'uploads',
          collections: [],
        }),
      ).not.toThrow();
    });

    it('should reject Gitea backend without app_id', () => {
      expect(() =>
        parseSiteConfig(
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
        parseSiteConfig({
          backend: { name: 'gitea', repo: 'owner/repo', app_id: 'test-app-id' },
          media_folder: 'uploads',
          collections: [],
        }),
      ).not.toThrow();
    });

    it('should reject config without media_folder', () => {
      expect(() =>
        // @ts-ignore - testing invalid config
        parseSiteConfig({ backend: { name: 'git-gateway' }, collections: [] }),
      ).toThrow();
    });

    it('should accept config without media_folder when using external media_library', () => {
      expect(() =>
        parseSiteConfig(
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
        parseSiteConfig(
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
        parseSiteConfig(
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
        parseSiteConfig(
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
        parseSiteConfig(
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
        parseSiteConfig(
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
        parseSiteConfig(
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
        parseSiteConfig({ backend: { name: 'git-gateway' }, media_folder: 123, collections: [] }),
      ).toThrow();
    });

    it('should reject config with non-string public_folder', () => {
      expect(() =>
        parseSiteConfig(
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
        parseSiteConfig(
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
        parseSiteConfig(
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
        parseSiteConfig(
          /** @type {any} */ ({
            backend: { name: 'git-gateway' },
            media_folder: 'uploads',
            singletons: [{ name: 'config' }],
          }),
        ),
      ).not.toThrow();
    });
  });

  describe('parseSiteConfig - additional edge cases', () => {
    it('should warn about editorial workflow', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      parseSiteConfig(
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

      parseSiteConfig(
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

      parseSiteConfig(
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

    it('should accept valid public_folder as absolute path', () => {
      expect(() =>
        parseSiteConfig(
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
        parseSiteConfig(
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
        parseSiteConfig(
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
        parseSiteConfig(
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
        parseSiteConfig(
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
        parseSiteConfig(
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

      parseSiteConfig(
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

      parseSiteConfig(
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
        parseSiteConfig(
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
        parseSiteConfig(
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

      parseSiteConfig(
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
        parseSiteConfig(
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
        parseSiteConfig(
          /** @type {any} */ ({
            backend: { name: 'git-gateway' },
            collections: [],
            media_libraries: { cloudinary: { cloud_name: 'test' } },
          }),
        ),
      ).not.toThrow();
    });
  });
});
