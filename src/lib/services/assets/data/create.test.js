import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createFileList, saveAssets, updatedStores } from './create.js';

// Mock dependencies
vi.mock('$lib/services/assets', () => ({
  allAssets: { subscribe: vi.fn() },
  focusedAsset: { set: vi.fn() },
  overlaidAsset: { set: vi.fn() },
  getAssetsByDirName: vi.fn(),
}));

vi.mock('$lib/services/assets/data', () => ({
  assetUpdatesToast: { set: vi.fn() },
}));

vi.mock('$lib/services/assets/kinds', () => ({
  getAssetKind: vi.fn(),
}));

vi.mock('$lib/services/backends', () => ({
  backend: { subscribe: vi.fn() },
}));

vi.mock('$lib/services/backends/save', () => ({
  saveChanges: vi.fn(),
}));

vi.mock('$lib/services/config', () => ({
  siteConfig: { subscribe: vi.fn() },
}));

vi.mock('$lib/services/integrations/media-libraries/default', () => ({
  /**
   * Get default media library options for testing.
   * @returns {object} Default options with disabled filename slugification.
   */
  getDefaultMediaLibraryOptions: () => ({
    config: { multiple: false, slugify_filename: false },
  }),
}));

vi.mock('$lib/services/utils/file', () => ({
  formatFileName: vi.fn((fileName) => fileName),
}));

vi.mock('$lib/services/contents/collection/data', () => ({
  UPDATE_TOAST_DEFAULT_STATE: {
    saved: false,
    published: false,
    deleted: false,
    count: 0,
  },
}));

vi.mock('svelte/store', () => ({
  get: vi.fn(),
}));

vi.mock('$lib/services/backends/git/shared/integration', () => ({
  skipCIEnabled: {
    subscribe: vi.fn((callback) => {
      callback(false);
      return vi.fn();
    }),
  },
}));

// Mock dependencies
vi.mock('$lib/services/assets', () => ({
  allAssets: {
    subscribe: vi.fn((callback) => {
      callback([]);
      return vi.fn();
    }),
  },
  focusedAsset: {
    set: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
  },
  overlaidAsset: {
    set: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
  },
  getAssetsByDirName: vi.fn().mockReturnValue([]),
}));

vi.mock('$lib/services/assets/data', () => ({
  assetUpdatesToast: {
    set: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
  },
}));

vi.mock('$lib/services/assets/kinds', () => ({
  getAssetKind: vi.fn().mockReturnValue('image'),
}));

vi.mock('$lib/services/backends', () => ({
  backend: {
    subscribe: vi.fn((callback) => {
      callback({ isGit: false });
      return vi.fn();
    }),
  },
}));

vi.mock('$lib/services/backends/save', () => ({
  saveChanges: vi.fn(),
}));

vi.mock('$lib/services/config', () => ({
  siteConfig: {
    subscribe: vi.fn((callback) => {
      callback({ backend: { skip_ci: true } });
      return vi.fn();
    }),
  },
}));

vi.mock('$lib/services/utils/file', () => ({
  formatFileName: vi.fn((fileName) => fileName),
}));

vi.mock('$lib/services/contents/collection/data', () => ({
  UPDATE_TOAST_DEFAULT_STATE: {
    saved: false,
    published: false,
    deleted: false,
    count: 0,
  },
}));

describe('assets/data/create', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
  });

  describe('createFileList', () => {
    it('should create file list for new uploads', () => {
      const mockFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });

      const uploadingAssets = {
        files: [mockFile],
        folder: {
          internalPath: '/images',
          collectionName: 'assets',
          publicPath: '/images',
          entryRelative: false,
          hasTemplateTags: false,
        },
        originalAsset: undefined,
      };

      const result = createFileList(uploadingAssets);

      expect(result).toEqual([
        {
          action: 'create',
          name: 'test.jpg',
          path: '/images/test.jpg',
          file: mockFile,
        },
      ]);
    });

    it('should call getAssetsByDirName when folder has internalPath', async () => {
      const { getAssetsByDirName } = await import('$lib/services/assets');
      const mockFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });

      const uploadingAssets = {
        files: [mockFile],
        folder: {
          internalPath: '/images',
          collectionName: 'assets',
          publicPath: '/images',
          entryRelative: false,
          hasTemplateTags: false,
        },
        originalAsset: undefined,
      };

      // Mock getAssetsByDirName to return some existing assets with full Asset structure
      vi.mocked(getAssetsByDirName).mockReturnValue([
        {
          name: 'existing.jpg',
          path: '/images/existing.jpg',
          sha: 'abc123',
          size: 1024,
          kind: 'image',
          folder: {
            internalPath: '/images',
            collectionName: 'assets',
            publicPath: '/images',
            entryRelative: false,
            hasTemplateTags: false,
          },
        },
        {
          name: 'another.jpg',
          path: '/images/another.jpg',
          sha: 'def456',
          size: 2048,
          kind: 'image',
          folder: {
            internalPath: '/images',
            collectionName: 'assets',
            publicPath: '/images',
            entryRelative: false,
            hasTemplateTags: false,
          },
        },
      ]);

      const result = createFileList(uploadingAssets);

      expect(getAssetsByDirName).toHaveBeenCalledWith('/images');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('test.jpg');
    });

    it('should create file list for asset updates', () => {
      const mockFile = new File(['content'], 'updated.jpg', { type: 'image/jpeg' });

      const uploadingAssets = {
        files: [mockFile],
        folder: {
          internalPath: '/images',
          collectionName: 'assets',
          publicPath: '/images',
          entryRelative: false,
          hasTemplateTags: false,
        },
        originalAsset: {
          name: 'original.jpg',
          path: '/images/original.jpg',
          sha: 'abc123',
          size: 1024,
          kind: /** @type {import('$lib/types/private').AssetKind} */ ('image'),
          folder: {
            internalPath: '/images',
            collectionName: 'assets',
            publicPath: '/images',
            entryRelative: false,
            hasTemplateTags: false,
          },
        },
      };

      const result = createFileList(uploadingAssets);

      expect(result).toEqual([
        {
          action: 'update',
          name: 'original.jpg',
          path: '/images/original.jpg',
          file: mockFile,
        },
      ]);
    });

    it('should handle multiple files', () => {
      const mockFile1 = new File(['content1'], 'test1.jpg', { type: 'image/jpeg' });
      const mockFile2 = new File(['content2'], 'test2.jpg', { type: 'image/jpeg' });

      const uploadingAssets = {
        files: [mockFile1, mockFile2],
        folder: {
          internalPath: '/images',
          collectionName: 'assets',
          publicPath: '/images',
          entryRelative: false,
          hasTemplateTags: false,
        },
        originalAsset: undefined,
      };

      const result = createFileList(uploadingAssets);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('test1.jpg');
      expect(result[1].name).toBe('test2.jpg');
    });
  });

  describe('createFileList - edge cases', () => {
    it('should handle folder with undefined internalPath', () => {
      const mockFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });

      const uploadingAssets = {
        files: [mockFile],
        folder: {
          internalPath: undefined,
          collectionName: 'assets',
          publicPath: '/images',
          entryRelative: false,
          hasTemplateTags: false,
        },
        originalAsset: undefined,
      };

      const result = createFileList(uploadingAssets);

      expect(result).toHaveLength(1);
      // When internalPath is undefined, join creates a path starting with /
      expect(result[0].action).toBe('create');
      expect(result[0].name).toBe('test.jpg');
      expect(result[0].file).toBe(mockFile);
    });

    it('should handle no folder', () => {
      const mockFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });

      const uploadingAssets = {
        files: [mockFile],
        folder: undefined,
        originalAsset: undefined,
      };

      const result = createFileList(uploadingAssets);

      expect(result).toHaveLength(1);
      expect(result[0].action).toBe('create');
      expect(result[0].name).toBe('test.jpg');
      expect(result[0].file).toBe(mockFile);
    });
  });

  describe('updatedStores', () => {
    it('should update toast with save count', async () => {
      const { assetUpdatesToast } = await import('$lib/services/assets/data');
      const { get } = await import('svelte/store');

      vi.mocked(get).mockReturnValue(undefined);

      updatedStores({ count: 3 });

      expect(assetUpdatesToast.set).toHaveBeenCalledWith({
        saved: true,
        published: false,
        deleted: false,
        count: 3,
      });
    });

    it('should update focusedAsset when it exists', async () => {
      const { focusedAsset, allAssets } = await import('$lib/services/assets');
      const { get } = await import('svelte/store');

      const oldAsset = {
        path: '/images/old.jpg',
        name: 'old.jpg',
        kind: 'image',
        size: 1024,
      };

      const newAsset = {
        path: '/images/old.jpg',
        name: 'old.jpg',
        kind: 'image',
        size: 2048,
      };

      vi.mocked(get).mockImplementation((store) => {
        if (store === focusedAsset) return oldAsset;
        if (store === allAssets) return [newAsset];
        return undefined;
      });

      updatedStores({ count: 1 });

      expect(focusedAsset.set).toHaveBeenCalledWith(newAsset);
    });

    it('should update overlaidAsset when it exists', async () => {
      const { overlaidAsset, allAssets } = await import('$lib/services/assets');
      const { get } = await import('svelte/store');

      const oldAsset = {
        path: '/images/old.jpg',
        name: 'old.jpg',
        kind: 'image',
        size: 1024,
      };

      const newAsset = {
        path: '/images/old.jpg',
        name: 'old.jpg',
        kind: 'image',
        size: 2048,
      };

      vi.mocked(get).mockImplementation((store) => {
        if (store === overlaidAsset) return oldAsset;
        if (store === allAssets) return [newAsset];
        return undefined;
      });

      updatedStores({ count: 1 });

      expect(overlaidAsset.set).toHaveBeenCalledWith(newAsset);
    });

    it('should update both focusedAsset and overlaidAsset when they exist', async () => {
      const { focusedAsset, overlaidAsset, allAssets } = await import('$lib/services/assets');
      const { get } = await import('svelte/store');

      const oldFocused = {
        path: '/images/focused.jpg',
        name: 'focused.jpg',
      };

      const oldOverlaid = {
        path: '/images/overlaid.jpg',
        name: 'overlaid.jpg',
      };

      const newFocused = {
        path: '/images/focused.jpg',
        name: 'focused.jpg',
        updated: true,
      };

      const newOverlaid = {
        path: '/images/overlaid.jpg',
        name: 'overlaid.jpg',
        updated: true,
      };

      vi.mocked(get).mockImplementation((store) => {
        if (store === focusedAsset) return oldFocused;
        if (store === overlaidAsset) return oldOverlaid;
        if (store === allAssets) return [newFocused, newOverlaid];
        return undefined;
      });

      updatedStores({ count: 2 });

      expect(focusedAsset.set).toHaveBeenCalledWith(newFocused);
      expect(overlaidAsset.set).toHaveBeenCalledWith(newOverlaid);
    });
  });

  describe('saveAssets', () => {
    it('should save assets and update stores', async () => {
      const mockFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });

      const uploadingAssets = {
        files: [mockFile],
        folder: {
          internalPath: '/images',
          collectionName: 'assets',
          publicPath: '/images',
          entryRelative: false,
          hasTemplateTags: false,
        },
        originalAsset: undefined,
      };

      const { saveChanges } = await import('$lib/services/backends/save');
      const { getAssetKind } = await import('$lib/services/assets/kinds');

      vi.mocked(saveChanges).mockResolvedValue({
        commit: { sha: 'abc123', files: {} },
        savedEntries: [],
        savedAssets: [],
      });
      vi.mocked(getAssetKind).mockReturnValue('image');

      await saveAssets(uploadingAssets, { commitType: 'create' });

      expect(saveChanges).toHaveBeenCalledWith({
        changes: [
          {
            action: 'create',
            path: '/images/test.jpg',
            data: mockFile,
          },
        ],
        savingAssets: [
          {
            name: 'test.jpg',
            path: '/images/test.jpg',
            size: mockFile.size,
            kind: 'image',
            folder: {
              internalPath: '/images',
              collectionName: 'assets',
              publicPath: '/images',
              entryRelative: false,
              hasTemplateTags: false,
            },
          },
        ],
        options: { commitType: 'create' },
      });
    });

    it('should handle empty file list', async () => {
      const uploadingAssets = {
        files: [],
        folder: {
          internalPath: '/images',
          collectionName: 'assets',
          publicPath: '/images',
          entryRelative: false,
          hasTemplateTags: false,
        },
        originalAsset: undefined,
      };

      const { saveChanges } = await import('$lib/services/backends/save');

      vi.mocked(saveChanges).mockResolvedValue({
        commit: { sha: 'def456', files: {} },
        savedEntries: [],
        savedAssets: [],
      });

      await saveAssets(uploadingAssets, { commitType: 'create' });

      expect(saveChanges).toHaveBeenCalledWith({
        changes: [],
        savingAssets: [],
        options: { commitType: 'create' },
      });
    });
  });
});
