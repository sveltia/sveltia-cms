import { describe, expect, it, vi } from 'vitest';

import { getFolderLabelByCollection, showAssetOverlay, showUploadAssetsDialog } from './index.js';

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

    it('should return "All Assets" when collectionName is undefined and internalPath is undefined', async () => {
      const folder = {
        collectionName: undefined,
        fileName: undefined,
        internalPath: undefined,
        publicPath: '/uploads',
        entryRelative: false,
        hasTemplateTags: false,
      };

      const result = getFolderLabelByCollection(folder);

      expect(result).toBe('All Assets');
    });

    it('should return "Global Assets" when collectionName is undefined but internalPath is defined', async () => {
      const folder = {
        collectionName: undefined,
        fileName: undefined,
        internalPath: 'static/uploads',
        publicPath: '/static/uploads',
        entryRelative: false,
        hasTemplateTags: false,
      };

      const result = getFolderLabelByCollection(folder);

      expect(result).toBe('Global Assets');
    });

    it('should return collection label when collection exists', async () => {
      const { getCollection, getCollectionLabel } = await import(
        '$lib/services/contents/collection'
      );

      // @ts-ignore - simplified mock for testing
      const mockCollection = { name: 'blog', label: 'Blog Posts' };

      // @ts-ignore - mocking with simplified data
      vi.mocked(getCollection).mockReturnValue(mockCollection);
      vi.mocked(getCollectionLabel).mockReturnValue('Blog Posts');

      const folder = {
        collectionName: 'blog',
        fileName: undefined,
        internalPath: 'static/blog',
        publicPath: '/static/blog',
        entryRelative: false,
        hasTemplateTags: false,
      };

      const result = getFolderLabelByCollection(folder);

      expect(getCollection).toHaveBeenCalledWith('blog');
      expect(getCollectionLabel).toHaveBeenCalledWith(mockCollection);
      expect(result).toBe('Blog Posts');
    });

    it('should return collection and file label when both exist', async () => {
      const { getCollection, getCollectionLabel } = await import(
        '$lib/services/contents/collection'
      );

      const { getCollectionFile, getCollectionFileLabel } = await import(
        '$lib/services/contents/collection/files'
      );

      // @ts-ignore - simplified mock for testing
      const mockCollection = { name: 'blog', label: 'Blog Posts' };
      // @ts-ignore - simplified mock for testing
      const mockFile = { name: 'featured', label: 'Featured Posts' };

      // @ts-ignore - mocking with simplified data
      vi.mocked(getCollection).mockReturnValue(mockCollection);
      vi.mocked(getCollectionLabel).mockReturnValue('Blog Posts');
      // @ts-ignore - mocking with simplified data
      vi.mocked(getCollectionFile).mockReturnValue(mockFile);
      vi.mocked(getCollectionFileLabel).mockReturnValue('Featured Posts');

      const folder = {
        collectionName: 'blog',
        fileName: 'featured',
        internalPath: 'static/blog/featured',
        publicPath: '/static/blog/featured',
        entryRelative: false,
        hasTemplateTags: false,
      };

      const result = getFolderLabelByCollection(folder);

      expect(getCollection).toHaveBeenCalledWith('blog');
      expect(getCollectionLabel).toHaveBeenCalledWith(mockCollection);
      expect(getCollectionFile).toHaveBeenCalledWith(mockCollection, 'featured');
      expect(getCollectionFileLabel).toHaveBeenCalledWith(mockFile);
      expect(result).toBe('Blog Posts › Featured Posts');
    });

    it('should return collection label and fileName when file is not found', async () => {
      const { getCollection, getCollectionLabel } = await import(
        '$lib/services/contents/collection'
      );

      const { getCollectionFile } = await import('$lib/services/contents/collection/files');
      // @ts-ignore - simplified mock for testing
      const mockCollection = { name: 'blog', label: 'Blog Posts' };

      // @ts-ignore - mocking with simplified data
      vi.mocked(getCollection).mockReturnValue(mockCollection);
      vi.mocked(getCollectionLabel).mockReturnValue('Blog Posts');
      vi.mocked(getCollectionFile).mockReturnValue(undefined);

      const folder = {
        collectionName: 'blog',
        fileName: 'unknown-file',
        internalPath: 'static/blog/unknown',
        publicPath: '/static/blog/unknown',
        entryRelative: false,
        hasTemplateTags: false,
      };

      const result = getFolderLabelByCollection(folder);

      expect(getCollection).toHaveBeenCalledWith('blog');
      expect(getCollectionLabel).toHaveBeenCalledWith(mockCollection);
      expect(getCollectionFile).toHaveBeenCalledWith(mockCollection, 'unknown-file');
      expect(result).toBe('Blog Posts › unknown-file');
    });
  });
});
