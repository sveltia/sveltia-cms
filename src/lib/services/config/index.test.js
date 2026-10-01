import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { cmsConfig, cmsConfigErrors, cmsConfigLoaded, cmsConfigVersion, DEV_SITE_URL } from '.';

// Mock external dependencies
vi.mock('@sveltia/utils/crypto', () => ({
  getHash: vi.fn().mockResolvedValue('mock-hash'),
}));

vi.mock('$lib/services/config/loader', () => ({
  fetchCmsConfig: vi.fn(),
}));

vi.mock('$lib/services/config/deprecations', () => ({
  warnDeprecation: vi.fn(),
}));

vi.mock('$lib/services/config/schema', () => ({
  getConfigSchemas: vi.fn().mockReturnValue(undefined),
  validateConfigSchema: vi.fn(),
}));

vi.mock('$lib/services/config/folders/assets', () => ({
  getAllAssetFolders: vi.fn().mockReturnValue([]),
}));

vi.mock('$lib/services/config/folders/entries', () => ({
  getAllEntryFolders: vi.fn().mockReturnValue([]),
}));

vi.mock('$lib/services/assets/folders', () => ({
  allAssetFolders: { current: [] },
  selectedAssetFolder: { current: undefined },
}));

vi.mock('$lib/services/contents', () => ({
  allEntryFolders: { current: [] },
}));

vi.mock('$lib/services/user/prefs.svelte', () => ({
  prefs: { devModeEnabled: false },
}));

vi.mock('$lib/services/backends', () => ({
  initBackend: vi.fn(),
  validBackendNames: ['git-gateway', 'github', 'gitlab', 'gitea'],
}));

vi.mock('$lib/services/backends/git/services', () => ({
  gitBackendServices: {
    github: {},
    gitlab: {},
    gitea: {},
  },
}));

// Mock i18n
vi.mock('@sveltia/i18n', () => ({
  _: vi.fn((key) => key),
  locale: { current: 'en', set: vi.fn() },
}));

describe('config/index', () => {
  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Reset stores
    cmsConfig.current = undefined;
    cmsConfigErrors.current = [];
    cmsConfigVersion.current = '0';
  });

  describe('constants', () => {
    it('should have DEV_SITE_URL constant', () => {
      // The actual URL depends on the environment, just check it's a localhost URL
      expect(DEV_SITE_URL).toMatch(/^https?:\/\/localhost:\d+$/);
    });
  });

  describe('stores', () => {
    it('should export config stores', () => {
      expect(cmsConfig).toBeDefined();
      expect(cmsConfigErrors).toBeDefined();
      expect(cmsConfigVersion).toBeDefined();
      expect(cmsConfigLoaded).toBeDefined();
    });

    describe('cmsConfigLoaded', () => {
      it('should be exported as reactive state', () => {
        expect(cmsConfigLoaded).toBeDefined();
        expect(typeof cmsConfigLoaded).toBe('object');
        expect('current' in cmsConfigLoaded).toBe(true);
      });

      it('should be false when cmsConfig is undefined and cmsConfigErrors is empty', async () => {
        cmsConfig.current = undefined;
        cmsConfigErrors.current = [];

        const loadedState = cmsConfigLoaded.current;

        expect(loadedState).toBe(false);
      });

      it('should be true when cmsConfig is defined', async () => {
        /** @type {any} */
        const mockConfig = {
          backend: { name: 'github', repo: 'owner/repo' },
          media_folder: 'uploads',
          collections: [{ name: 'posts', label: 'Posts', folder: 'posts' }],
        };

        cmsConfig.current = mockConfig;
        cmsConfigErrors.current = [];

        const loadedState = cmsConfigLoaded.current;

        expect(loadedState).toBe(true);
      });

      it('should be true when cmsConfigErrors has entries', async () => {
        cmsConfig.current = undefined;
        cmsConfigErrors.current = ['Error 1', 'Error 2'];

        const loadedState = cmsConfigLoaded.current;

        expect(loadedState).toBe(true);
      });

      it('should be true when both cmsConfig and cmsConfigErrors are populated', async () => {
        /** @type {any} */
        const mockConfig = {
          backend: { name: 'github', repo: 'owner/repo' },
          media_folder: 'uploads',
        };

        cmsConfig.current = mockConfig;
        cmsConfigErrors.current = ['Some error'];

        const loadedState = cmsConfigLoaded.current;

        expect(loadedState).toBe(true);
      });
    });
  });
});
