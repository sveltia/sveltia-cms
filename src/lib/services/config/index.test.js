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
    get: vi.fn(() => ({ devModeEnabled: false })),
  };
});

vi.mock('$lib/services/config/loader', () => ({
  fetchSiteConfig: vi.fn(),
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
  validBackendNames: ['git-gateway', 'github', 'gitlab'],
  gitBackendServices: [],
}));

// Mock i18n
vi.mock('svelte-i18n', () => ({
  init: vi.fn().mockResolvedValue({}),
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
});
