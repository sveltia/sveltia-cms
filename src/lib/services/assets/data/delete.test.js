import { beforeEach, describe, expect, it, vi } from 'vitest';

import { deleteAssets, updateStores } from './delete.js';

// Mock dependencies
vi.mock('$lib/services/assets', () => ({
  focusedAsset: {
    update: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
  },
}));

vi.mock('$lib/services/assets/data', () => ({
  assetUpdatesToast: {
    set: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
  },
}));

vi.mock('$lib/services/backends/save', () => ({
  saveChanges: vi.fn(),
}));

vi.mock('$lib/services/contents/collection/data', () => ({
  UPDATE_TOAST_DEFAULT_STATE: {
    saved: false,
    published: false,
    deleted: false,
    count: 0,
  },
}));

describe('assets/data/delete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('updateStores', () => {
    /**
     * Create a mock asset for testing.
     * @param {string} path Asset path.
     * @param {string} name Asset name.
     * @returns {import('$lib/types/private').Asset} Mock asset.
     */
    const createMockAsset = (path, name) => ({
      path,
      name,
      sha: 'mock-sha',
      size: 1024,
      kind: /** @type {import('$lib/types/private').AssetKind} */ ('image'),
      folder: {
        internalPath: '/images',
        collectionName: 'assets',
        publicPath: '/images',
        entryRelative: false,
        hasTemplateTags: false,
      },
    });

    it('should clear focused asset if it matches deleted assets', async () => {
      const deletedAssets = [
        createMockAsset('/images/photo1.jpg', 'photo1.jpg'),
        createMockAsset('/images/photo2.jpg', 'photo2.jpg'),
      ];

      const mockFocusedAsset = createMockAsset('/images/photo1.jpg', 'photo1.jpg');
      const { focusedAsset } = await import('$lib/services/assets');
      const { assetUpdatesToast } = await import('$lib/services/assets/data');

      vi.mocked(focusedAsset.update).mockImplementation((fn) => {
        const result = fn(mockFocusedAsset);

        expect(result).toBeUndefined();
      });

      updateStores({ assets: deletedAssets });

      expect(focusedAsset.update).toHaveBeenCalledTimes(1);
      expect(assetUpdatesToast.set).toHaveBeenCalledWith({
        saved: false,
        published: false,
        deleted: true,
        count: 2,
      });
    });

    it('should keep focused asset if it does not match deleted assets', async () => {
      const deletedAssets = [createMockAsset('/images/photo1.jpg', 'photo1.jpg')];
      const mockFocusedAsset = createMockAsset('/images/different.jpg', 'different.jpg');
      const { focusedAsset } = await import('$lib/services/assets');

      vi.mocked(focusedAsset.update).mockImplementation((fn) => {
        const result = fn(mockFocusedAsset);

        expect(result).toBe(mockFocusedAsset);
      });

      updateStores({ assets: deletedAssets });

      expect(focusedAsset.update).toHaveBeenCalledTimes(1);
    });

    it('should handle undefined focused asset', async () => {
      const deletedAssets = [createMockAsset('/images/photo1.jpg', 'photo1.jpg')];
      const { focusedAsset } = await import('$lib/services/assets');

      vi.mocked(focusedAsset.update).mockImplementation((fn) => {
        const result = fn(undefined);

        expect(result).toBeUndefined();
      });

      updateStores({ assets: deletedAssets });

      expect(focusedAsset.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteAssets', () => {
    /**
     * Create a mock asset with SHA for testing.
     * @param {string} path Asset path.
     * @param {string} name Asset name.
     * @param {string} sha Asset SHA.
     * @returns {import('$lib/types/private').Asset} Mock asset.
     */
    const createMockAssetWithSha = (path, name, sha) => ({
      path,
      name,
      sha,
      size: 1024,
      kind: /** @type {import('$lib/types/private').AssetKind} */ ('image'),
      folder: {
        internalPath: '/images',
        collectionName: 'assets',
        publicPath: '/images',
        entryRelative: false,
        hasTemplateTags: false,
      },
    });

    it('should call saveChanges with correct parameters', async () => {
      const assetsToDelete = [
        createMockAssetWithSha('/images/photo1.jpg', 'photo1.jpg', 'sha1'),
        createMockAssetWithSha('/images/photo2.jpg', 'photo2.jpg', 'sha2'),
      ];

      const { saveChanges } = await import('$lib/services/backends/save');

      vi.mocked(saveChanges).mockResolvedValue({
        commit: { sha: 'abc123', files: {} },
        savedEntries: [],
        savedAssets: [],
      });

      await deleteAssets(assetsToDelete);

      expect(saveChanges).toHaveBeenCalledWith({
        changes: [
          { action: 'delete', path: '/images/photo1.jpg', previousSha: 'sha1' },
          { action: 'delete', path: '/images/photo2.jpg', previousSha: 'sha2' },
        ],
        options: { commitType: 'deleteMedia' },
      });
    });

    it('should call updateStores after successful deletion', async () => {
      const assetsToDelete = [createMockAssetWithSha('/images/photo1.jpg', 'photo1.jpg', 'sha1')];
      const { saveChanges } = await import('$lib/services/backends/save');
      const { assetUpdatesToast } = await import('$lib/services/assets/data');

      vi.mocked(saveChanges).mockResolvedValue({
        commit: { sha: 'def456', files: {} },
        savedEntries: [],
        savedAssets: [],
      });

      await deleteAssets(assetsToDelete);

      expect(assetUpdatesToast.set).toHaveBeenCalledWith({
        saved: false,
        published: false,
        deleted: true,
        count: 1,
      });
    });

    it('should handle empty assets array', async () => {
      const { saveChanges } = await import('$lib/services/backends/save');

      vi.mocked(saveChanges).mockResolvedValue({
        commit: { sha: 'ghi789', files: {} },
        savedEntries: [],
        savedAssets: [],
      });

      await deleteAssets([]);

      expect(saveChanges).toHaveBeenCalledWith({
        changes: [],
        options: { commitType: 'deleteMedia' },
      });
    });
  });
});
