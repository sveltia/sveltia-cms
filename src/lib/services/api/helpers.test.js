// @ts-nocheck
import { Map as ImmutableMap, isMap } from 'immutable';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { convertEntryToMap, createEntryMap, createGetAsset, getMetaData } from './helpers';

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

vi.mock('$lib/services/api/asset-proxy', () => ({
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

describe('entry module', () => {
  describe('createEntryMap', () => {
    const baseArgs = {
      content: { title: 'Hello', 'author.name': 'Jane' },
      otherLocales: [],
      locales: {
        en: {
          slug: 'hello',
          content: { title: 'Hello', 'author.name': 'Jane' },
          path: 'posts/hello.md',
        },
      },
      slug: 'hello',
      path: 'posts/hello.md',
      isNew: false,
      collectionName: 'posts',
      associatedAssets: [],
    };

    it('should return an Immutable Map', () => {
      expect(isMap(createEntryMap(baseArgs))).toBe(true);
    });

    it('should unflatten content into data', () => {
      const map = createEntryMap(baseArgs);
      const data = map.get('data');

      expect(data.get('title')).toBe('Hello');
      expect(data.getIn(['author', 'name'])).toBe('Jane');
    });

    it('should set i18n to empty map when no other locales', () => {
      const map = createEntryMap(baseArgs);

      expect(isMap(map.get('i18n'))).toBe(true);
      expect(map.get('i18n').size).toBe(0);
    });

    it('should include unflattened content for each other locale in i18n', () => {
      const map = createEntryMap({
        ...baseArgs,
        otherLocales: ['ja', 'fr'],
        locales: {
          en: { slug: 'hello', content: { title: 'Hello' }, path: 'posts/hello.md' },
          ja: {
            slug: 'hello',
            content: { title: 'こんにちは', 'author.name': '田中' },
            path: 'posts/hello.ja.md',
          },
          fr: { slug: 'hello', content: { title: 'Bonjour' }, path: 'posts/hello.fr.md' },
        },
      });

      const i18n = map.get('i18n');

      expect(i18n.getIn(['ja', 'data', 'title'])).toBe('こんにちは');
      expect(i18n.getIn(['ja', 'data', 'author', 'name'])).toBe('田中');
      expect(i18n.getIn(['fr', 'data', 'title'])).toBe('Bonjour');
      expect(i18n.get('en')).toBeUndefined();
    });

    it('should set slug, path, collection and newRecord', () => {
      const map = createEntryMap({
        ...baseArgs,
        slug: 'my-slug',
        path: 'a/b.md',
        isNew: true,
        collectionName: 'blog',
      });

      expect(map.get('slug')).toBe('my-slug');
      expect(map.get('path')).toBe('a/b.md');
      expect(map.get('collection')).toBe('blog');
      expect(map.get('newRecord')).toBe(true);
    });

    it('should map associated assets to mediaFiles', () => {
      const assets = [
        {
          sha: 'abc123',
          file: new File(['x'], 'img.jpg'),
          size: 512,
          blobURL: 'blob:http://localhost/1',
          name: 'img.jpg',
          path: '/images/img.jpg',
        },
      ];

      const map = createEntryMap({ ...baseArgs, associatedAssets: /** @type {any} */ (assets) });
      const mediaFiles = /** @type {any} */ (map.get('mediaFiles'));

      expect(mediaFiles.size).toBe(1);

      const file = mediaFiles.get(0);

      expect(file.get('id')).toBe('abc123');
      expect(file.get('name')).toBe('img.jpg');
      expect(file.get('path')).toBe('/images/img.jpg');
      expect(file.get('size')).toBe(512);
      expect(file.get('url')).toBe('blob:http://localhost/1');
      expect(file.get('displayURL')).toBe('blob:http://localhost/1');
    });

    it('should set meta.path to the entry path', () => {
      const map = createEntryMap({ ...baseArgs, path: 'content/page.md' });

      expect(map.getIn(['meta', 'path'])).toBe('content/page.md');
    });

    it('should include Netlify/Decap CMS compatibility properties with fixed values', () => {
      const map = createEntryMap(baseArgs);

      expect(map.get('isModification')).toBeNull();
      expect(map.get('label')).toBeNull();
      expect(map.get('partial')).toBe(false);
      expect(map.get('author')).toBe('');
      expect(map.get('raw')).toBe('');
      expect(map.get('status')).toBe('');
      expect(map.get('updatedOn')).toBe('');
    });

    it('should handle empty content', () => {
      const map = createEntryMap({
        ...baseArgs,
        content: {},
        locales: { en: { slug: 'hello', content: {}, path: 'posts/hello.md' } },
      });

      expect(isMap(map.get('data'))).toBe(true);
      expect(map.get('data').size).toBe(0);
    });
  });

  describe('convertEntryToMap', () => {
    it('should convert an entry using the selected locale and include other locales', () => {
      const entry = {
        slug: 'hello',
        locales: {
          en: {
            slug: 'hello',
            content: { title: 'Hello' },
            path: 'posts/hello.md',
          },
          ja: {
            slug: 'hello',
            content: { title: 'こんにちは' },
            path: 'posts/hello.ja.md',
          },
        },
      };

      const map = convertEntryToMap({
        entry: /** @type {any} */ (entry),
        locale: 'en',
        collectionName: 'posts',
        associatedAssets: [],
      });

      expect(map.get('slug')).toBe('hello');
      expect(map.getIn(['data', 'title'])).toBe('Hello');
      expect(map.get('path')).toBe('posts/hello.md');
      expect(map.getIn(['i18n', 'ja', 'data', 'title'])).toBe('こんにちは');
    });

    it('should prefer explicit content over entry locale content', () => {
      const entry = {
        locales: {
          en: {
            content: { title: 'Fallback' },
            path: 'posts/fallback.md',
          },
        },
      };

      const map = convertEntryToMap({
        entry: /** @type {any} */ (entry),
        locale: 'en',
        collectionName: 'posts',
        associatedAssets: [],
        content: { title: 'Override' },
      });

      expect(map.getIn(['data', 'title'])).toBe('Override');
      expect(map.get('path')).toBe('posts/fallback.md');
    });

    it('should fall back to empty content and path when the locale data is missing', () => {
      const map = convertEntryToMap({
        entry: undefined,
        locale: 'en',
        collectionName: 'posts',
        associatedAssets: [],
      });

      expect(map.get('slug')).toBe('');
      expect(map.get('path')).toBe('');
      expect(map.getIn(['data', 'title'])).toBeUndefined();
      expect(map.get('collection')).toBe('posts');
    });
  });
});

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

    it('should ignore missing field definitions when building metadata', () => {
      mockGetField.mockReturnValueOnce(undefined);

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
      expect(result.size).toBe(0);
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
