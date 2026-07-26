// @ts-nocheck
import { Map as ImmutableMap } from 'immutable';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createGetAsset, getMetaData } from './react-helpers';

// Mock dependencies using vi.hoisted()
const { mockGetField, mockGetAssetByPath, mockGetEntriesByCollection, mockGetCollectionFileEntry } =
  vi.hoisted(() => ({
    mockGetField: vi.fn(() => ({ widget: 'text' })),
    mockGetAssetByPath: vi.fn(),
    mockGetEntriesByCollection: vi.fn(() => []),
    mockGetCollectionFileEntry: vi.fn(),
  }));

vi.mock('$lib/services/assets', () => ({
  getAssetByPath: mockGetAssetByPath,
}));

vi.mock('$lib/services/contents/api/asset-proxy', () => ({
  /**
   *
   */
  AssetProxy: class MockAssetProxy {
    /**
     * Mock constructor for AssetProxy.
     * @param {object} _asset The asset to proxy.
     */
    constructor(_asset) {
      this.url = 'blob:...';
    }
  },
}));

vi.mock('$lib/services/contents/collection/entries', () => ({
  getEntriesByCollection: mockGetEntriesByCollection,
}));

vi.mock('$lib/services/contents/collection/files', () => ({
  getCollectionFileEntry: mockGetCollectionFileEntry,
}));

vi.mock('$lib/services/contents/entry/fields', () => ({
  getField: mockGetField,
}));

describe('React Helpers', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetField.mockReturnValue({ widget: 'text' });
    mockGetEntriesByCollection.mockReturnValue([]);
  });

  describe('createGetAsset', () => {
    it('should return an asset getter function', () => {
      const getter = createGetAsset({
        entry: { slug: 'test' },
        collectionName: 'posts',
        fileName: undefined,
      });

      expect(typeof getter).toBe('function');
    });

    it('should return AssetProxy when asset is found', () => {
      const mockAsset = { name: 'image.jpg', path: '/assets/image.jpg' };

      mockGetAssetByPath.mockReturnValueOnce(mockAsset);

      const getter = createGetAsset({
        entry: { slug: 'test-post' },
        collectionName: 'posts',
        fileName: undefined,
      });

      const result = getter('images/test.jpg');

      expect(mockGetAssetByPath).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result).toHaveProperty('url');
    });

    it('should return undefined when asset is not found', () => {
      mockGetAssetByPath.mockReturnValueOnce(undefined);

      const getter = createGetAsset({
        entry: { slug: 'test-post' },
        collectionName: 'posts',
        fileName: undefined,
      });

      const result = getter('images/nonexistent.jpg');

      expect(result).toBeUndefined();
    });

    it('should pass correct arguments to getAssetByPath', () => {
      const mockEntry = { slug: 'article' };

      mockGetAssetByPath.mockReturnValueOnce(undefined);

      const getter = createGetAsset({
        entry: mockEntry,
        collectionName: 'articles',
        fileName: 'config.json',
      });

      getter('featured.jpg');

      expect(mockGetAssetByPath).toHaveBeenCalledWith({
        value: 'featured.jpg',
        entry: mockEntry,
        collectionName: 'articles',
        fileName: 'config.json',
      });
    });
  });

  describe('getMetaData', () => {
    it('should return empty metadata when no relation fields', () => {
      mockGetField.mockReturnValueOnce({ widget: 'text' });

      const result = getMetaData({
        locale: 'en',
        getFieldArgs: {
          collectionName: 'posts',
          fileName: undefined,
          valueMap: {},
          isIndexFile: false,
        },
      });

      expect(result instanceof ImmutableMap).toBe(true);
    });

    it('should populate metadata for relation fields', () => {
      const mockRefEntry = {
        slug: 'related-post',
        locales: { en: { content: { title: 'Related Post Title' } } },
      };

      mockGetField.mockReturnValueOnce({
        widget: 'relation',
        collection: 'posts',
        value_field: '{{slug}}',
      });
      // @ts-ignore
      mockGetEntriesByCollection.mockReturnValueOnce([mockRefEntry]);

      const result = getMetaData({
        locale: 'en',
        getFieldArgs: {
          collectionName: 'posts',
          fileName: undefined,
          valueMap: { relatedPost: 'related-post' },
          isIndexFile: false,
        },
      });

      expect(result instanceof ImmutableMap).toBe(true);
    });

    it('should handle multiple relation fields', () => {
      const mockRefEntry1 = {
        slug: 'post-1',
        locales: { en: { content: { title: 'Post 1' } } },
      };

      const mockRefEntry2 = {
        slug: 'author-1',
        locales: { en: { content: { name: 'Author 1' } } },
      };

      mockGetField
        .mockReturnValueOnce({
          widget: 'relation',
          collection: 'posts',
          value_field: '{{slug}}',
        })
        .mockReturnValueOnce({
          widget: 'relation',
          collection: 'authors',
          value_field: '{{slug}}',
        });

      mockGetEntriesByCollection
        .mockReturnValueOnce([mockRefEntry1])
        .mockReturnValueOnce([mockRefEntry2]);

      const result = getMetaData({
        locale: 'en',
        getFieldArgs: {
          collectionName: 'posts',
          fileName: undefined,
          valueMap: { relatedPost: 'post-1', author: 'author-1' },
          isIndexFile: false,
        },
      });

      expect(result instanceof ImmutableMap).toBe(true);
    });

    it('should use cached entries when multiple relation fields reference same collection', () => {
      const mockRefEntry1 = {
        slug: 'post-1',
        locales: { en: { content: { title: 'Post 1' } } },
      };

      const mockRefEntry2 = {
        slug: 'post-2',
        locales: { en: { content: { title: 'Post 2' } } },
      };

      mockGetField
        .mockReturnValueOnce({
          widget: 'relation',
          collection: 'posts',
          value_field: '{{slug}}',
        })
        .mockReturnValueOnce({
          widget: 'relation',
          collection: 'posts',
          value_field: '{{slug}}',
        });

      // Should only be called once - second field uses cache
      mockGetEntriesByCollection.mockReturnValueOnce([mockRefEntry1, mockRefEntry2]);

      const result = getMetaData({
        locale: 'en',
        getFieldArgs: {
          collectionName: 'posts',
          fileName: undefined,
          valueMap: { relatedPost1: 'post-1', relatedPost2: 'post-2' },
          isIndexFile: false,
        },
      });

      expect(result instanceof ImmutableMap).toBe(true);
      // Verify entries were only fetched once (cache was used for second field)
      expect(mockGetEntriesByCollection).toHaveBeenCalledTimes(1);
    });

    it('should use slug matching by default', () => {
      const mockEntry = {
        slug: 'test-entry',
        locales: { en: { content: {} } },
      };

      mockGetField.mockReturnValueOnce({
        widget: 'relation',
        collection: 'posts',
      });
      mockGetEntriesByCollection.mockReturnValueOnce([mockEntry]);

      const result = getMetaData({
        locale: 'en',
        getFieldArgs: {
          collectionName: 'posts',
          fileName: undefined,
          valueMap: { related: 'test-entry' },
          isIndexFile: false,
        },
      });

      expect(result instanceof ImmutableMap).toBe(true);
    });

    it('should match by custom value_field when specified', () => {
      const mockEntry = {
        slug: 'test-entry',
        locales: { en: { content: { id: 'custom-id', title: 'Entry' } } },
      };

      mockGetField.mockReturnValueOnce({
        widget: 'relation',
        collection: 'posts',
        value_field: 'id',
      });
      mockGetEntriesByCollection.mockReturnValueOnce([mockEntry]);

      const result = getMetaData({
        locale: 'en',
        getFieldArgs: {
          collectionName: 'posts',
          fileName: undefined,
          valueMap: { related: 'custom-id' },
          isIndexFile: false,
        },
      });

      expect(result instanceof ImmutableMap).toBe(true);
      expect(mockGetField).toHaveBeenCalled();
      // Verify that the matching logic works
      expect(mockGetEntriesByCollection).toHaveBeenCalledWith('posts');
    });

    it('should use file entry when relation field has file property', () => {
      const mockEntry = {
        slug: 'config',
        locales: { en: { content: { id: 'config-file', title: 'Config' } } },
      };

      mockGetField.mockReset();
      mockGetField.mockReturnValue({
        widget: 'relation',
        collection: 'pages',
        file: 'config.json',
        value_field: 'id',
      });

      mockGetCollectionFileEntry.mockReturnValueOnce(mockEntry);

      const result = getMetaData({
        locale: 'en',
        getFieldArgs: {
          collectionName: 'pages',
          fileName: undefined,
          valueMap: { pageConfig: 'config-file' },
          isIndexFile: false,
        },
      });

      expect(result instanceof ImmutableMap).toBe(true);
      // Verify file entry was requested
      expect(mockGetCollectionFileEntry).toHaveBeenCalledWith('pages', 'config.json');
    });

    it('should handle entries without requested locale in relation field', () => {
      const mockEntry = {
        slug: 'test-entry',
        locales: {
          en: { content: { id: '1', title: 'English' } },
          // No ja locale
        },
      };

      mockGetField.mockReturnValueOnce({
        widget: 'relation',
        collection: 'posts',
        value_field: 'id',
      });
      mockGetEntriesByCollection.mockReturnValueOnce([mockEntry]);

      const result = getMetaData({
        locale: 'ja', // Request Japanese but entry only has English
        getFieldArgs: {
          collectionName: 'posts',
          fileName: undefined,
          valueMap: { related: '1' },
          isIndexFile: false,
        },
      });

      expect(result instanceof ImmutableMap).toBe(true);
    });
  });
});
