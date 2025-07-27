import { beforeEach, describe, expect, it, vi } from 'vitest';

import { initSettings } from './settings.js';

// Mock dependencies
vi.mock('@sveltia/utils/storage', () => ({
  IndexedDB: vi.fn().mockImplementation(() => ({
    get: vi.fn().mockResolvedValue({}),
    set: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('fast-deep-equal', () => ({
  default: vi.fn((a, b) => JSON.stringify(a) === JSON.stringify(b)),
}));

vi.mock('svelte/store', () => ({
  get: vi.fn().mockReturnValue({}),
  writable: vi.fn(() => ({
    set: vi.fn(),
    subscribe: vi.fn((callback) => {
      callback({});
      return vi.fn();
    }),
    update: vi.fn(),
  })),
}));

vi.mock('$lib/services/assets/folders', () => ({
  selectedAssetFolder: {
    subscribe: vi.fn((callback) => {
      callback({ internalPath: '/uploads' });
      return vi.fn();
    }),
  },
}));

vi.mock('$lib/services/assets/view', () => ({
  currentView: {
    set: vi.fn(),
    subscribe: vi.fn((callback) => {
      callback({ sortKey: 'name', sortOrder: 'asc' });
      return vi.fn();
    }),
  },
  defaultView: { sortKey: 'name', sortOrder: 'asc' },
}));

vi.mock('$lib/services/backends', () => ({
  backend: {
    subscribe: vi.fn((callback) => {
      callback({ name: 'git-gateway' });
      return vi.fn();
    }),
  },
}));

describe('assets/view/settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initSettings', () => {
    it('should initialize settings with repository database', async () => {
      const backendService = {
        isGit: true,
        name: 'github',
        label: 'GitHub',
        repository: {
          service: /** @type {'github'} */ ('github'),
          label: 'Test',
          owner: 'test',
          repo: 'test',
          databaseName: 'test-db',
        },
        init: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
        fetchFiles: vi.fn(),
        commitChanges: vi.fn(),
      };

      await initSettings(backendService);

      const { IndexedDB } = await import('@sveltia/utils/storage');

      expect(IndexedDB).toHaveBeenCalledWith('test-db', 'ui-settings');
    });

    it('should skip initialization without repository database', async () => {
      const backendService = {
        isGit: false,
        name: 'local',
        label: 'Local',
        repository: {
          service: /** @type {''} */ (''),
          label: 'Local',
          owner: '',
          repo: '',
          databaseName: undefined,
        },
        init: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
        fetchFiles: vi.fn(),
        commitChanges: vi.fn(),
      };

      await initSettings(backendService);

      const { IndexedDB } = await import('@sveltia/utils/storage');

      expect(IndexedDB).not.toHaveBeenCalled();
    });

    it('should subscribe to asset folder changes', async () => {
      const { selectedAssetFolder } = await import('$lib/services/assets/folders');

      vi.mocked(selectedAssetFolder.subscribe).mockImplementation((callback) => {
        callback({
          collectionName: undefined,
          fileName: undefined,
          internalPath: '/uploads',
          publicPath: '/uploads',
          entryRelative: false,
          hasTemplateTags: false,
        });
        return vi.fn();
      });

      const backendService = {
        isGit: true,
        name: 'github',
        label: 'GitHub',
        repository: {
          service: /** @type {'github'} */ ('github'),
          label: 'Test',
          owner: 'test',
          repo: 'test',
          databaseName: 'test-db',
        },
        init: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
        fetchFiles: vi.fn(),
        commitChanges: vi.fn(),
      };

      await initSettings(backendService);

      expect(selectedAssetFolder.subscribe).toHaveBeenCalled();
    });

    it('should handle backend initialization for git backends', async () => {
      // Since backend.subscribe is called at module level, we just verify the mock was set up
      // and that the initSettings function can handle git backends properly
      const gitBackend = {
        isGit: true,
        name: 'github',
        label: 'GitHub',
        repository: {
          service: /** @type {'github'} */ ('github'),
          label: 'Test',
          owner: 'test',
          repo: 'test',
          databaseName: 'test-db',
        },
        init: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
        fetchFiles: vi.fn(),
        commitChanges: vi.fn(),
      };

      // This should not throw any errors
      await expect(initSettings(gitBackend)).resolves.not.toThrow();
    });

    it('should handle backend initialization for local backends', async () => {
      // Since backend.subscribe is called at module level, we just verify the mock was set up
      // and that the initSettings function can handle local backends properly
      const localBackend = {
        isGit: false,
        name: 'local',
        label: 'Local',
        repository: {
          service: /** @type {''} */ (''),
          label: 'Local',
          owner: '',
          repo: '',
          databaseName: undefined,
        },
        init: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
        fetchFiles: vi.fn(),
        commitChanges: vi.fn(),
      };

      // This should not throw any errors
      await expect(initSettings(localBackend)).resolves.not.toThrow();
    });
  });
});
