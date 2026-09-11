import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createFileList, saveAssets, updatedStores } from './create.js';

// Mock dependencies
vi.mock('$lib/services/assets', () => ({
  allAssets: { current: undefined },
  focusedAsset: { set: vi.fn() },
  overlaidAsset: { set: vi.fn() },
  getAssetByInternalPath: vi.fn(),
  getAssetsByDirName: vi.fn(),
}));

vi.mock('$lib/services/assets/data', () => ({
  assetUpdatesToast: { set: vi.fn() },
}));

vi.mock('$lib/services/assets/kinds', () => ({
  getAssetKind: vi.fn(),
}));

vi.mock('$lib/services/backends/save', () => ({
  saveChanges: vi.fn(),
}));

vi.mock('$lib/services/config', () => ({
  cmsConfig: { current: undefined },
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

vi.mock('$lib/services/backends/git/shared/integration', () => ({
  skipCIConfigured: {
    current: false,
  },
  skipCIEnabled: {
    current: false,
  },
}));

// Mock dependencies
vi.mock('$lib/services/assets', () => ({
  allAssets: {
    current: [],
  },
  focusedAsset: { current: undefined },
  overlaidAsset: { current: undefined },
  getAssetByInternalPath: vi.fn(),
  getAssetsByDirName: vi.fn().mockReturnValue([]),
}));

vi.mock('$lib/services/assets/data', () => ({
  assetUpdatesToast: { current: undefined },
}));

vi.mock('$lib/services/assets/kinds', () => ({
  getAssetKind: vi.fn().mockReturnValue('image'),
}));

vi.mock('$lib/services/backends/save', () => ({
  saveChanges: vi.fn(),
}));

vi.mock('$lib/services/config', () => ({
  cmsConfig: {
    current: { backend: { skip_ci: true } },
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

    const { getAssetsByDirName } = await import('$lib/services/assets');

    vi.mocked(getAssetsByDirName).mockReturnValue([]);
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
        originalAssets: undefined,
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
        originalAssets: undefined,
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

    it('should create file list for asset updates when file name matches', () => {
      const mockFile = new File(['content'], 'original.jpg', { type: 'image/jpeg' });

      const uploadingAssets = {
        files: [mockFile],
        folder: {
          internalPath: '/images',
          collectionName: 'assets',
          publicPath: '/images',
          entryRelative: false,
          hasTemplateTags: false,
        },
        originalAssets: [
          {
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
        ],
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

    it('should give a replacement file the original asset’s name', () => {
      const mockFile = new File(['content'], 'new-photo.jpg', { type: 'image/jpeg' });

      const uploadingAssets = {
        files: [mockFile],
        folder: {
          internalPath: '/images',
          collectionName: 'assets',
          publicPath: '/images',
          entryRelative: false,
          hasTemplateTags: false,
        },
        originalAssets: [
          {
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
        ],
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

    it('should overwrite a same-named asset when replaceDuplicates is enabled', async () => {
      const { getAssetsByDirName } = await import('$lib/services/assets');

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
      ]);

      const mockFile = new File(['content'], 'existing.jpg', { type: 'image/jpeg' });

      const uploadingAssets = {
        files: [mockFile],
        folder: {
          internalPath: '/images',
          collectionName: 'assets',
          publicPath: '/images',
          entryRelative: false,
          hasTemplateTags: false,
        },
        replaceDuplicates: true,
      };

      const result = createFileList(uploadingAssets);

      expect(result).toEqual([
        {
          action: 'update',
          name: 'existing.jpg',
          path: '/images/existing.jpg',
          file: mockFile,
        },
      ]);
    });

    it('should keep a same-named asset when replaceDuplicates is disabled', async () => {
      const { getAssetsByDirName } = await import('$lib/services/assets');
      const { formatFileName } = await import('$lib/services/utils/file');

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
      ]);

      const mockFile = new File(['content'], 'existing.jpg', { type: 'image/jpeg' });

      const uploadingAssets = {
        files: [mockFile],
        folder: {
          internalPath: '/images',
          collectionName: 'assets',
          publicPath: '/images',
          entryRelative: false,
          hasTemplateTags: false,
        },
      };

      const result = createFileList(uploadingAssets);

      // The unique name is `formatFileName`’s job, which is stubbed here to return the name as is
      expect(formatFileName).toHaveBeenCalledWith('existing.jpg', {
        slugificationEnabled: false,
        assetNamesInSameFolder: ['existing.jpg'],
      });
      expect(result[0].action).toBe('create');
    });

    it('should match original assets case-insensitively', () => {
      const mockFile = new File(['content'], 'Photo.JPG', { type: 'image/jpeg' });

      const uploadingAssets = {
        files: [mockFile],
        folder: {
          internalPath: '/images',
          collectionName: 'assets',
          publicPath: '/images',
          entryRelative: false,
          hasTemplateTags: false,
        },
        originalAssets: [
          {
            name: 'photo.jpg',
            path: '/images/photo.jpg',
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
        ],
      };

      const result = createFileList(uploadingAssets);

      expect(result).toEqual([
        {
          action: 'update',
          name: 'photo.jpg',
          path: '/images/photo.jpg',
          file: mockFile,
        },
      ]);
    });

    it('should handle multiple files with mixed matching against originalAssets', async () => {
      const { getAssetsByDirName } = await import('$lib/services/assets');

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
      ]);

      const file1 = new File(['content1'], 'existing.jpg', { type: 'image/jpeg' });
      const file2 = new File(['content2'], 'new.jpg', { type: 'image/jpeg' });

      const uploadingAssets = {
        files: [file1, file2],
        folder: {
          internalPath: '/images',
          collectionName: 'assets',
          publicPath: '/images',
          entryRelative: false,
          hasTemplateTags: false,
        },
        originalAssets: [
          {
            name: 'existing.jpg',
            path: '/images/existing.jpg',
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
        ],
      };

      const result = createFileList(uploadingAssets);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        action: 'update',
        name: 'existing.jpg',
        path: '/images/existing.jpg',
        file: file1,
      });
      expect(result[1]).toEqual({
        action: 'create',
        name: 'new.jpg',
        path: '/images/new.jpg',
        file: file2,
      });
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
        originalAssets: undefined,
      };

      const result = createFileList(uploadingAssets);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('test1.jpg');
      expect(result[1].name).toBe('test2.jpg');
    });

    it('should not add duplicate file name to assetNamesInSameFolder', async () => {
      const { getAssetsByDirName } = await import('$lib/services/assets');

      // Pre-populate the folder with the file name we're about to upload
      vi.mocked(getAssetsByDirName).mockReturnValue([
        {
          name: 'test.jpg',
          path: '/images/test.jpg',
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
      ]);

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
        originalAssets: undefined,
      };

      const result = createFileList(uploadingAssets);

      // The file name already exists in the folder, so the array should not grow
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('test.jpg');
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
        originalAssets: undefined,
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
        originalAssets: undefined,
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
      const { skipCIConfigured } = await import('$lib/services/backends/git/shared/integration');

      /** @type {any} */ (skipCIConfigured).current = false;

      updatedStores({ count: 3 });

      expect(assetUpdatesToast.current).toEqual({
        saved: true,
        published: false,
        deleted: false,
        count: 3,
      });
    });

    it('should set published to true when skipCIConfigured is true and skipCI is disabled', async () => {
      const { assetUpdatesToast } = await import('$lib/services/assets/data');

      const { skipCIConfigured, skipCIEnabled } =
        await import('$lib/services/backends/git/shared/integration');

      /** @type {any} */ (skipCIConfigured).current = true;
      /** @type {any} */ (skipCIEnabled).current = false;

      updatedStores({ count: 1 });

      expect(assetUpdatesToast.current).toEqual(
        expect.objectContaining({ saved: true, published: true, count: 1 }),
      );
    });

    it('should set published to false when skipCI is enabled', async () => {
      const { assetUpdatesToast } = await import('$lib/services/assets/data');

      const { skipCIConfigured, skipCIEnabled } =
        await import('$lib/services/backends/git/shared/integration');

      /** @type {any} */ (skipCIConfigured).current = true;
      /** @type {any} */ (skipCIEnabled).current = true;

      updatedStores({ count: 1 });

      expect(assetUpdatesToast.current).toEqual(
        expect.objectContaining({ saved: true, published: false, count: 1 }),
      );
    });

    it('should update focusedAsset when it exists', async () => {
      const { focusedAsset, getAssetByInternalPath } = await import('$lib/services/assets');

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

      focusedAsset.current = /** @type {any} */ (oldAsset);
      vi.mocked(getAssetByInternalPath).mockReturnValue(/** @type {any} */ (newAsset));

      updatedStores({ count: 1 });

      expect(getAssetByInternalPath).toHaveBeenCalledWith('/images/old.jpg');
      expect(focusedAsset.current).toEqual(newAsset);
    });

    it('should update overlaidAsset when it exists', async () => {
      const { overlaidAsset, getAssetByInternalPath } = await import('$lib/services/assets');

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

      overlaidAsset.current = /** @type {any} */ (oldAsset);
      vi.mocked(getAssetByInternalPath).mockReturnValue(/** @type {any} */ (newAsset));

      updatedStores({ count: 1 });

      expect(getAssetByInternalPath).toHaveBeenCalledWith('/images/old.jpg');
      expect(overlaidAsset.current).toEqual(newAsset);
    });

    it('should update both focusedAsset and overlaidAsset when they exist', async () => {
      const { focusedAsset, getAssetByInternalPath, overlaidAsset } =
        await import('$lib/services/assets');

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

      focusedAsset.current = /** @type {any} */ (oldFocused);
      overlaidAsset.current = /** @type {any} */ (oldOverlaid);
      vi.mocked(getAssetByInternalPath).mockImplementation(
        (path) => /** @type {any} */ (path === '/images/focused.jpg' ? newFocused : newOverlaid),
      );

      updatedStores({ count: 2 });

      expect(getAssetByInternalPath).toHaveBeenCalledWith('/images/focused.jpg');
      expect(getAssetByInternalPath).toHaveBeenCalledWith('/images/overlaid.jpg');
      expect(focusedAsset.current).toEqual(newFocused);
      expect(overlaidAsset.current).toEqual(newOverlaid);
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
        originalAssets: undefined,
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
        originalAssets: undefined,
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
