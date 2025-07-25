import { describe, expect, it, vi } from 'vitest';
import { showAssetOverlay, showUploadAssetsDialog, getFolderLabelByCollection } from './index.js';

// Mock dependencies
vi.mock('svelte-i18n', () => ({
  _: {
    subscribe: vi.fn((callback) => {
      /**
       * Mock translation function for testing.
       * @param {string} key Translation key to look up.
       * @returns {string} Translated text or original key if not found.
       */
      const mockTranslationFunction = (key) => {
        /** @type {Record<string, string>} */
        const translations = {
          all_assets: 'All Assets',
          global_assets: 'Global Assets',
        };

        return translations[key] || key;
      };

      callback(mockTranslationFunction);
      return vi.fn();
    }),
  },
}));

vi.mock('$lib/services/contents/collection', () => ({
  getCollection: vi.fn(),
  getCollectionLabel: vi.fn(),
}));

vi.mock('$lib/services/contents/collection/files', () => ({
  getCollectionFile: vi.fn(),
  getCollectionFileLabel: vi.fn(),
}));

vi.mock('$lib/services/assets', () => ({
  allAssets: { subscribe: vi.fn(() => vi.fn()) },
  selectedAssets: {
    subscribe: vi.fn(() => vi.fn()),
    set: vi.fn(),
  },
  uploadingAssets: {
    subscribe: vi.fn((callback) => {
      callback({ files: [] });
      return vi.fn();
    }),
  },
}));

vi.mock('$lib/services/assets/folders', () => ({
  selectedAssetFolder: { subscribe: vi.fn(() => vi.fn()) },
}));

vi.mock('$lib/services/assets/view/filter', () => ({
  filterAssets: vi.fn((assets) => assets),
}));

vi.mock('$lib/services/assets/view/group', () => ({
  groupAssets: vi.fn(),
}));

vi.mock('$lib/services/assets/view/sort', () => ({
  sortAssets: vi.fn(),
}));

vi.mock('$lib/services/user/prefs', () => ({
  prefs: {
    subscribe: vi.fn((callback) => {
      callback({ devModeEnabled: false });
      return vi.fn();
    }),
  },
}));

describe('assets/view/index', () => {
  describe('showAssetOverlay', () => {
    it('should be defined as a store', () => {
      expect(showAssetOverlay).toBeDefined();
      expect(typeof showAssetOverlay.subscribe).toBe('function');
    });
  });

  describe('showUploadAssetsDialog', () => {
    it('should be defined as a store', () => {
      expect(showUploadAssetsDialog).toBeDefined();
      expect(typeof showUploadAssetsDialog.subscribe).toBe('function');
    });
  });

  describe('getFolderLabelByCollection', () => {
    it('should return collection name when collection is not found', async () => {
      const { getCollection, getCollectionLabel } = await import(
        '$lib/services/contents/collection'
      );

      vi.mocked(getCollection).mockReturnValue(undefined);

      const folder = {
        collectionName: 'blog',
        fileName: undefined,
        internalPath: 'static/uploads',
        publicPath: '/static/uploads',
        entryRelative: false,
        hasTemplateTags: false,
      };

      const result = getFolderLabelByCollection(folder);

      expect(getCollection).toHaveBeenCalledWith('blog');
      expect(getCollectionLabel).not.toHaveBeenCalled();
      expect(result).toBe('blog');
    });
  });
});
