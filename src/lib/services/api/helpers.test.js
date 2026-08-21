// @ts-nocheck
import { Map as ImmutableMap, isMap } from 'immutable';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildEntry,
  buildPreviewData,
  convertEntryToMap,
  createEntryMap,
  createGetAsset,
  getAssociatedPreviewAssets,
  getMetaData,
} from './helpers';

// Mock dependencies using vi.hoisted()
const {
  mockGetField,
  mockGetAssetByPath,
  mockGetEntriesByCollection,
  mockGetCollectionFileEntry,
  mockGetAssetFolder,
  mockIsAssetInFolder,
  mockGet,
} = vi.hoisted(() => ({
  mockGetField: vi.fn(() => ({ widget: 'text' })),
  mockGetAssetByPath: vi.fn(),
  mockGetEntriesByCollection: vi.fn(() => []),
  mockGetCollectionFileEntry: vi.fn(),
  mockGetAssetFolder: vi.fn(),
  mockIsAssetInFolder: vi.fn(),
  mockGet: vi.fn((store) => store?.value ?? []),
}));

vi.mock('$lib/services/assets', () => ({
  allAssets: { value: [] },
  getAssetByPath: mockGetAssetByPath,
  isAssetInFolder: mockIsAssetInFolder,
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

vi.mock('$lib/services/assets/folders', () => ({
  getAssetFolder: mockGetAssetFolder,
}));

vi.mock('svelte/store', () => ({
  get: mockGet,
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

  describe('buildEntry', () => {
    it('should build entry with current values replacing locales', () => {
      const originalEntry = {
        slug: 'hello',
        subPath: 'posts/hello.md',
        locales: {
          en: {
            slug: 'hello',
            path: 'posts/hello.md',
            content: { title: 'Hello', body: 'Old content' },
          },
          ja: {
            slug: 'hello',
            path: 'posts/hello.ja.md',
            content: { title: 'こんにちは', body: '古いコンテンツ' },
          },
        },
      };

      const currentValues = {
        en: { title: 'Hello Updated', body: 'New content' },
        ja: { title: 'こんにちは更新', body: '新しいコンテンツ' },
      };

      const result = buildEntry({ originalEntry, currentValues });

      expect(result.slug).toBe('hello');
      expect(result.subPath).toBe('posts/hello.md');
      expect(result.locales.en.slug).toBe('hello');
      expect(result.locales.en.path).toBe('posts/hello.md');
      expect(result.locales.en.content).toEqual({ title: 'Hello Updated', body: 'New content' });
      expect(result.locales.ja.content).toEqual({
        title: 'こんにちは更新',
        body: '新しいコンテンツ',
      });
    });

    it('should preserve locale-specific slugs', () => {
      const originalEntry = {
        slug: 'default-slug',
        locales: {
          en: { slug: 'english-slug', path: 'posts/en.md', content: {} },
          ja: { slug: 'japanese-slug', path: 'posts/ja.md', content: {} },
        },
      };

      const currentValues = {
        en: { title: 'New English' },
        ja: { title: '新しい日本語' },
      };

      const result = buildEntry({ originalEntry, currentValues });

      expect(result.locales.en.slug).toBe('english-slug');
      expect(result.locales.ja.slug).toBe('japanese-slug');
    });

    it('should fall back to original slug when locale-specific slug is missing', () => {
      const originalEntry = {
        slug: 'default-slug',
        locales: {
          en: { path: 'posts/en.md', content: {} }, // No slug
          ja: { slug: 'japanese-slug', path: 'posts/ja.md', content: {} },
        },
      };

      const currentValues = {
        en: { title: 'English' },
        ja: { title: '日本語' },
      };

      const result = buildEntry({ originalEntry, currentValues });

      expect(result.locales.en.slug).toBe('default-slug');
      expect(result.locales.ja.slug).toBe('japanese-slug');
    });

    it('should preserve locale-specific paths', () => {
      const originalEntry = {
        slug: 'test',
        subPath: 'posts/test.md',
        locales: {
          en: { slug: 'test', path: 'posts/en/test.md', content: {} },
          ja: { slug: 'test', path: 'posts/ja/test.md', content: {} },
        },
      };

      const currentValues = {
        en: { title: 'English' },
        ja: { title: '日本語' },
      };

      const result = buildEntry({ originalEntry, currentValues });

      expect(result.locales.en.path).toBe('posts/en/test.md');
      expect(result.locales.ja.path).toBe('posts/ja/test.md');
    });

    it('should fall back to subPath when locale-specific path is missing', () => {
      const originalEntry = {
        slug: 'test',
        subPath: 'posts/default.md',
        locales: {
          en: { slug: 'test', content: {} }, // No path
          ja: { slug: 'test', path: 'posts/ja.md', content: {} },
        },
      };

      const currentValues = {
        en: { title: 'English' },
        ja: { title: '日本語' },
      };

      const result = buildEntry({ originalEntry, currentValues });

      expect(result.locales.en.path).toBe('posts/default.md');
      expect(result.locales.ja.path).toBe('posts/ja.md');
    });

    it('should handle undefined originalEntry gracefully', () => {
      const currentValues = {
        en: { title: 'Content' },
      };

      const result = buildEntry({ originalEntry: undefined, currentValues });

      expect(result).toBeDefined();
      expect(result.locales.en.content).toEqual({ title: 'Content' });
      expect(result.locales.en.slug).toBeUndefined();
      expect(result.locales.en.path).toBeUndefined();
    });

    it('should handle empty currentValues', () => {
      const originalEntry = {
        slug: 'test',
        subPath: 'posts/test.md',
        locales: {
          en: { slug: 'test', path: 'posts/test.md', content: { title: 'Old' } },
        },
      };

      const result = buildEntry({ originalEntry, currentValues: {} });

      expect(result.slug).toBe('test');
      expect(result.subPath).toBe('posts/test.md');
      expect(result.locales).toEqual({});
    });

    it('should handle entry with undefined subPath', () => {
      const originalEntry = {
        slug: 'test',
        locales: {
          en: { slug: 'test', content: {} }, // No path in locale either
        },
      };

      const currentValues = {
        en: { title: 'Content' },
      };

      const result = buildEntry({ originalEntry, currentValues });

      expect(result.locales.en.path).toBeUndefined();
    });

    it('should preserve all other properties from originalEntry', () => {
      const originalEntry = {
        slug: 'test',
        subPath: 'posts/test.md',
        sha: 'abc123',
        status: 'published',
        customProp: 'custom-value',
        locales: {
          en: { slug: 'test', path: 'posts/test.md', content: { title: 'Old' } },
        },
      };

      const currentValues = {
        en: { title: 'New' },
      };

      const result = buildEntry({ originalEntry, currentValues });

      expect(result.sha).toBe('abc123');
      expect(result.status).toBe('published');
      expect(result.customProp).toBe('custom-value');
    });

    it('should handle multiple new locales in currentValues', () => {
      const originalEntry = {
        slug: 'test',
        subPath: 'posts/test.md',
        locales: {
          en: { slug: 'test', path: 'posts/test.md', content: {} },
        },
      };

      const currentValues = {
        en: { title: 'English' },
        ja: { title: '日本語' },
        fr: { title: 'Français' },
      };

      const result = buildEntry({ originalEntry, currentValues });

      expect(Object.keys(result.locales)).toEqual(['en', 'ja', 'fr']);
      expect(result.locales.en.content).toEqual({ title: 'English' });
      expect(result.locales.ja.content).toEqual({ title: '日本語' });
      expect(result.locales.fr.content).toEqual({ title: 'Français' });
      // ja and fr should fall back to original slug and subPath
      expect(result.locales.ja.slug).toBe('test');
      expect(result.locales.ja.path).toBe('posts/test.md');
      expect(result.locales.fr.slug).toBe('test');
      expect(result.locales.fr.path).toBe('posts/test.md');
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

  describe('getAssociatedPreviewAssets', () => {
    beforeEach(() => {
      mockGetAssetFolder.mockReset();
      mockIsAssetInFolder.mockReset();
      mockGet.mockReset();
    });

    it('should return empty array when asset folder is not found', () => {
      mockGetAssetFolder.mockReturnValueOnce(null);

      const result = getAssociatedPreviewAssets({
        collectionName: 'posts',
        fileName: undefined,
      });

      expect(result).toEqual([]);
      expect(mockGetAssetFolder).toHaveBeenCalledWith({
        collectionName: 'posts',
        fileName: undefined,
      });
    });

    it('should filter and return assets when asset folder is found', () => {
      const mockAssetFolder = { collectionName: 'posts', internalPath: 'assets' };

      const mockAssets = [
        { name: 'image1.jpg', path: '/assets/image1.jpg' },
        { name: 'image2.jpg', path: '/assets/image2.jpg' },
      ];

      mockGetAssetFolder.mockReturnValueOnce(mockAssetFolder);
      mockGet.mockReturnValueOnce(mockAssets);
      mockIsAssetInFolder.mockImplementation(() => true);

      const result = getAssociatedPreviewAssets({
        collectionName: 'posts',
        fileName: undefined,
      });

      expect(result).toEqual(mockAssets);
      expect(mockGetAssetFolder).toHaveBeenCalledWith({
        collectionName: 'posts',
        fileName: undefined,
      });
      expect(mockIsAssetInFolder).toHaveBeenCalledTimes(2);
    });

    it('should filter assets based on folder membership', () => {
      const mockAssetFolder = { collectionName: 'posts', internalPath: 'assets' };

      const mockAssets = [
        { name: 'image1.jpg', path: '/assets/image1.jpg' },
        { name: 'image2.jpg', path: '/other/image2.jpg' },
      ];

      mockGetAssetFolder.mockReturnValueOnce(mockAssetFolder);
      mockGet.mockReturnValueOnce(mockAssets);
      mockIsAssetInFolder.mockImplementation((asset) => asset.path.includes('/assets/'));

      const result = getAssociatedPreviewAssets({
        collectionName: 'posts',
        fileName: 'index.md',
      });

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('image1.jpg');
    });
  });

  describe('buildPreviewData', () => {
    beforeEach(() => {
      mockGetField.mockReset();
      mockGetField.mockReturnValue({ widget: 'text' });
      mockGetAssetFolder.mockReset();
      mockIsAssetInFolder.mockReset();
      mockGet.mockReset();
      mockGet.mockReturnValue([]);
    });

    it('should not build the field metadata until it’s read', () => {
      const mockDraft = {
        collectionName: 'posts',
        fileName: undefined,
        isIndexFile: false,
        originalEntry: {
          slug: 'test-post',
          locales: { en: { slug: 'test-post', path: '/posts/test-post', content: {} } },
        },
        currentValues: { en: { title: 'Updated Title' } },
      };

      const result = buildPreviewData({ draft: mockDraft, locale: 'en' });

      // Building the metadata looks up a field config for every value in the entry, which a custom
      // field control, the only consumer of `entryMap` alone, shouldn’t have to pay for
      expect(result.entryMap).toBeDefined();
      expect(mockGetField).not.toHaveBeenCalled();

      const { fieldsMetaData } = result;

      expect(isMap(fieldsMetaData)).toBe(true);
      expect(mockGetField).toHaveBeenCalledOnce();

      // The result is kept, so several previews reading it in the same tick share the computation
      expect(result.fieldsMetaData).toBe(fieldsMetaData);
      expect(mockGetField).toHaveBeenCalledOnce();
    });

    it('should build preview data with all required properties', () => {
      const mockDraft = {
        collectionName: 'posts',
        fileName: undefined,
        isIndexFile: false,
        originalEntry: {
          slug: 'test-post',
          locales: {
            en: {
              slug: 'test-post',
              path: '/posts/test-post',
              content: { title: 'Test Post' },
            },
          },
        },
        currentValues: {
          en: { title: 'Updated Title' },
        },
      };

      const result = buildPreviewData({
        draft: mockDraft,
        locale: 'en',
      });

      expect(result).toHaveProperty('entryMap');
      expect(result).toHaveProperty('valueMap');
      expect(result).toHaveProperty('getFieldArgs');
      expect(result).toHaveProperty('fieldsMetaData');
      expect(result).toHaveProperty('getAsset');
      expect(isMap(result.entryMap)).toBe(true);
      expect(result.valueMap).toEqual({ title: 'Updated Title' });
      expect(result.getFieldArgs).toEqual({
        collectionName: 'posts',
        fileName: undefined,
        valueMap: { title: 'Updated Title' },
        isIndexFile: false,
      });
      expect(isMap(result.fieldsMetaData)).toBe(true);
      expect(typeof result.getAsset).toBe('function');
    });

    it('should use current values for the specified locale', () => {
      const mockDraft = {
        collectionName: 'posts',
        fileName: undefined,
        isIndexFile: false,
        originalEntry: {
          slug: 'test-post',
          locales: {
            en: {
              slug: 'test-post',
              path: '/posts/test-post',
              content: { title: 'English Title' },
            },
            ja: {
              slug: 'テスト記事',
              path: '/ja/posts/テスト記事',
              content: { title: '日本語タイトル' },
            },
          },
        },
        currentValues: {
          en: { title: 'Updated EN' },
          ja: { title: '更新されたJA' },
        },
      };

      const resultEn = buildPreviewData({
        draft: mockDraft,
        locale: 'en',
      });

      const resultJa = buildPreviewData({
        draft: mockDraft,
        locale: 'ja',
      });

      expect(resultEn.valueMap).toEqual({ title: 'Updated EN' });
      expect(resultJa.valueMap).toEqual({ title: '更新されたJA' });
    });

    it('should include entryMap from converted entry data', () => {
      mockGetAssetFolder.mockReturnValueOnce(null);

      const mockDraft = {
        collectionName: 'posts',
        fileName: undefined,
        isIndexFile: false,
        originalEntry: {
          slug: 'test-post',
          locales: {
            en: {
              slug: 'test-post',
              path: '/posts/test-post',
              content: { title: 'Test Post' },
            },
          },
        },
        currentValues: {
          en: { title: 'Updated Title' },
        },
      };

      const result = buildPreviewData({
        draft: mockDraft,
        locale: 'en',
      });

      expect(result.entryMap).toBeDefined();
      expect(isMap(result.entryMap)).toBe(true);
      expect(result.entryMap.get('slug')).toBe('test-post');
      expect(result.entryMap.get('collection')).toBe('posts');
    });
  });
});
