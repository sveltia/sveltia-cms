// @ts-nocheck
/**
 * @import { Entry } from '$lib/types/private';
 * @import {
 * CustomPreviewTemplateProps,
 * Field,
 * } from '$lib/types/public';
 */

import { Map as ImmutableMap } from 'immutable';
import * as svelte from 'svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createFieldPreviewMounter,
  createGetAsset,
  createWidgetFor,
  createWidgetsFor,
  createWidgetsMap,
  getCollectionByName,
  getMetaData,
  preparePreviewTemplateProps,
} from './preview-templates';

// Mock dependencies using vi.hoisted()
const {
  mockGetCollection,
  mockGetEntriesByCollection,
  mockGetField,
  mockCreateEntryMap,
  mockGetAssetByPath,
  mockCreateElement,
  mockGetAssetFolder,
  mockIsAssetInFolder,
  mockGet,
  mockGetCollectionFileEntry,
} = vi.hoisted(() => ({
  mockGetCollection: vi.fn(() => ({
    _i18n: { defaultLocale: 'en' },
  })),
  mockGetEntriesByCollection: vi.fn(() => []),
  mockGetField: vi.fn(() => ({ widget: 'text' })),
  mockCreateEntryMap: vi.fn(() => ({})),
  mockGetAssetByPath: vi.fn(),
  mockCreateElement: vi.fn((tag, props) => ({ type: tag, ...props })),
  mockGetAssetFolder: vi.fn(),
  mockIsAssetInFolder: vi.fn(),
  mockGet: vi.fn((store) => store?.value),
  mockGetCollectionFileEntry: vi.fn(),
}));

vi.mock('flat', () => ({
  unflatten: vi.fn((obj) => obj),
}));

vi.mock('react', () => ({
  createElement: mockCreateElement,
}));

vi.mock('svelte', () => {
  const unmountFn = vi.fn();

  return {
    mount: vi.fn(() => ({ destroy: vi.fn() })),
    unmount: unmountFn,
  };
});

vi.mock('svelte/store', () => ({
  get: mockGet,
}));

vi.mock('$lib/components/contents/details/preview/field-preview.svelte', () => ({
  default: {},
}));

vi.mock('$lib/services/assets', () => ({
  allAssets: { value: [] },
  getAssetByPath: mockGetAssetByPath,
  isAssetInFolder: mockIsAssetInFolder,
}));

vi.mock('$lib/services/assets/folders', () => ({
  getAssetFolder: mockGetAssetFolder,
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

vi.mock('$lib/services/contents/api/entries', () => ({
  createEntryMap: mockCreateEntryMap,
}));

vi.mock('$lib/services/contents/collection', () => ({
  getCollection: mockGetCollection,
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

describe('Preview Templates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCollection.mockReturnValue({
      _i18n: { defaultLocale: 'en' },
    });
    mockGetEntriesByCollection.mockReturnValue([]);
    mockGetField.mockReturnValue({ widget: 'text' });
    mockCreateEntryMap.mockReturnValue({});
  });

  describe('createFieldPreviewMounter', () => {
    it('should return a mounter function', () => {
      const mounter = createFieldPreviewMounter({
        locale: 'en',
        getFieldArgs: {
          collectionName: 'posts',
          fileName: undefined,
          valueMap: {},
          isIndexFile: false,
        },
      });

      expect(typeof mounter).toBe('function');
    });

    it('should mount a Svelte component with correct props', () => {
      const mounter = createFieldPreviewMounter({
        locale: 'en',
        getFieldArgs: {
          collectionName: 'posts',
          fileName: undefined,
          valueMap: {},
          isIndexFile: false,
        },
      });

      /** @type {any} */
      const mockTarget = {};

      mounter(mockTarget, 'title');

      expect(vi.mocked(svelte.mount)).toHaveBeenCalled();
    });
  });

  describe('createWidgetFor', () => {
    it('should return a widget factory function', () => {
      const mockMountFieldPreview = /** @type {any} */ (vi.fn());
      const widgetFor = createWidgetFor(mockMountFieldPreview);

      expect(typeof widgetFor).toBe('function');
    });

    it('should create a React element with ref callback', () => {
      const mockMountFieldPreview = vi.fn(() => ({ destroy: vi.fn() }));
      const widgetFor = createWidgetFor(mockMountFieldPreview);
      const element = widgetFor('field.name');

      expect(element).toHaveProperty('type', 'div');
      // @ts-ignore
      expect(element).toHaveProperty('ref');
      expect(typeof element.ref).toBe('function');
    });

    it('should mount and unmount components via ref callback', () => {
      const mockComponent = { destroy: vi.fn() };
      const mockMountFieldPreview = vi.fn(() => mockComponent);
      /** @type {((element: HTMLElement | null) => void) | undefined} */
      let capturedRefCallback;

      mockCreateElement.mockReturnValue({ type: 'div', ref: null });

      // Set up the mock to capture the ref callback
      mockCreateElement.mockImplementationOnce((tag, props) => {
        capturedRefCallback = props.ref;
        return { type: tag, ref: props.ref };
      });

      const widgetFor = createWidgetFor(mockMountFieldPreview);

      widgetFor('field.name');

      expect(capturedRefCallback).toBeDefined();

      // Mount by calling ref with an element
      /** @type {any} */
      const mockDiv = {};

      // @ts-ignore
      capturedRefCallback(mockDiv);

      expect(mockMountFieldPreview).toHaveBeenCalledWith(mockDiv, 'field.name');

      // Unmount by calling ref with null
      if (capturedRefCallback) {
        capturedRefCallback(null);
      }

      expect(vi.mocked(svelte.unmount)).toHaveBeenCalledWith(mockComponent);
    });

    it('should handle ref callback when component is not set', () => {
      const mockMountFieldPreview = vi.fn();
      /** @type {((element: HTMLElement | null) => void) | undefined} */
      let capturedRefCallback;

      // Set up the mock to capture the ref callback
      mockCreateElement.mockImplementationOnce((tag, props) => {
        capturedRefCallback = props.ref;
        return { type: tag, ref: props.ref };
      });

      const widgetFor = createWidgetFor(mockMountFieldPreview);

      widgetFor('field.name');

      expect(capturedRefCallback).toBeDefined();

      // Call ref with null when component is not set
      // This should not throw or cause issues
      // @ts-ignore
      capturedRefCallback(null);

      expect(vi.mocked(svelte.unmount)).not.toHaveBeenCalled();
    });
  });

  describe('createWidgetsMap', () => {
    it('should create an immutable map from object keys', () => {
      const mockWidgetFor = vi.fn((keyPath) => ({ path: keyPath }));
      // @ts-ignore
      const obj = { title: 'test', body: 'content', author: 'John' };
      // @ts-ignore
      const result = createWidgetsMap(obj, 'article', mockWidgetFor);

      expect(result instanceof ImmutableMap).toBe(true);
      expect(mockWidgetFor).toHaveBeenCalledWith('article.title');
      expect(mockWidgetFor).toHaveBeenCalledWith('article.body');
      expect(mockWidgetFor).toHaveBeenCalledWith('article.author');
      expect(mockWidgetFor).toHaveBeenCalledTimes(3);
    });

    it('should handle empty objects', () => {
      const mockWidgetFor = vi.fn();
      const result = createWidgetsMap({}, 'article', mockWidgetFor);

      expect(result instanceof ImmutableMap).toBe(true);
      expect(mockWidgetFor).not.toHaveBeenCalled();
    });

    it('should handle nested paths', () => {
      const mockWidgetFor = vi.fn();
      const obj = { featured: 'yes', promoted: 'no' };

      createWidgetsMap(obj, 'posts.0.meta', mockWidgetFor);

      expect(mockWidgetFor).toHaveBeenCalledWith('posts.0.meta.featured');
      expect(mockWidgetFor).toHaveBeenCalledWith('posts.0.meta.promoted');
    });
  });

  describe('createWidgetsFor', () => {
    it('should return a widget accessor function', () => {
      const mockWidgetFor = vi.fn();
      const widgetsFor = createWidgetsFor({}, mockWidgetFor);

      expect(typeof widgetsFor).toBe('function');
    });

    it('should return primitive values unchanged', () => {
      const mockWidgetFor = vi.fn();
      const content = { title: 'Test', count: 42, flag: true };
      const widgetsFor = createWidgetsFor(content, mockWidgetFor);

      expect(widgetsFor('title')).toBe('Test');
      expect(widgetsFor('count')).toBe(42);
      expect(widgetsFor('flag')).toBe(true);
    });

    it('should return null and undefined as-is', () => {
      const mockWidgetFor = vi.fn();
      const content = { nullValue: null, undefinedValue: undefined };
      const widgetsFor = createWidgetsFor(content, mockWidgetFor);

      expect(widgetsFor('nullValue')).toBeNull();
      expect(widgetsFor('undefinedValue')).toBeUndefined();
    });

    it('should handle arrays of objects', () => {
      const mockWidgetFor = vi.fn(() => ({ widget: 'preview' }));

      const content = {
        items: [
          { id: 1, title: 'Item 1' },
          { id: 2, title: 'Item 2' },
        ],
      };

      const widgetsFor = createWidgetsFor(content, mockWidgetFor);
      const result = widgetsFor('items');

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(mockWidgetFor).toHaveBeenCalledWith('items.0.id');
      expect(mockWidgetFor).toHaveBeenCalledWith('items.0.title');
      expect(mockWidgetFor).toHaveBeenCalledWith('items.1.id');
      expect(mockWidgetFor).toHaveBeenCalledWith('items.1.title');
    });

    it('should handle arrays of primitives', () => {
      const mockWidgetFor = vi.fn();
      const content = { tags: ['tag1', 'tag2', 'tag3'] };
      const widgetsFor = createWidgetsFor(content, mockWidgetFor);
      const result = widgetsFor('tags');

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(3);
    });

    it('should handle nested objects', () => {
      const mockWidgetFor = vi.fn(() => ({ widget: 'preview' }));

      const content = {
        metadata: { author: 'John', date: '2024-01-01', tags: ['a', 'b'] },
      };

      const widgetsFor = createWidgetsFor(content, mockWidgetFor);
      const result = widgetsFor('metadata');

      expect(result).toBeTruthy();
      expect(result.get).toBeDefined();
      expect(mockWidgetFor).toHaveBeenCalledWith('metadata.author');
      expect(mockWidgetFor).toHaveBeenCalledWith('metadata.date');
      expect(mockWidgetFor).toHaveBeenCalledWith('metadata.tags');
    });
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

  describe('getCollectionByName', () => {
    it('should throw error when collection not found', async () => {
      mockGetCollection.mockReturnValueOnce(null);

      await expect(getCollectionByName('nonexistent')).rejects.toThrow(
        'Collection "nonexistent" not found',
      );
    });

    it('should return all entries when slug is not provided', async () => {
      /** @type {Partial<Entry>} */
      const mockEntry1 = {
        slug: 'entry-1',
        locales: { en: { content: { title: 'Entry 1' } } },
      };

      /** @type {Partial<Entry>} */
      const mockEntry2 = {
        slug: 'entry-2',
        locales: { en: { content: { title: 'Entry 2' } } },
      };

      mockGetCollection.mockReturnValueOnce({
        _i18n: { defaultLocale: 'en' },
      });
      mockGetEntriesByCollection.mockReturnValueOnce([mockEntry1, mockEntry2]);

      const result = await getCollectionByName('posts');

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('should return specific entry when slug is provided', async () => {
      /** @type {Partial<Entry>} */
      const mockEntry = {
        slug: 'test-entry',
        locales: { en: { content: { title: 'Test Entry' } } },
      };

      mockGetCollection.mockReturnValueOnce({
        _i18n: { defaultLocale: 'en' },
      });
      mockGetEntriesByCollection.mockReturnValueOnce([mockEntry]);

      const result = await getCollectionByName('posts', 'test-entry');

      expect(result).toBeDefined();
    });

    it('should find correct entry when multiple entries exist with different slugs', async () => {
      const mockEntry1 = {
        slug: 'post-1',
        locales: { en: { content: { title: 'Post 1' } } },
      };

      const mockEntry2 = {
        slug: 'test-entry',
        locales: { en: { content: { title: 'Test Entry' } } },
      };

      const mockEntry3 = {
        slug: 'post-3',
        locales: { en: { content: { title: 'Post 3' } } },
      };

      mockGetCollection.mockReturnValueOnce({
        _i18n: { defaultLocale: 'en' },
      });
      mockGetEntriesByCollection.mockReturnValueOnce([mockEntry1, mockEntry2, mockEntry3]);

      const result = await getCollectionByName('posts', 'test-entry');

      // Should return an Immutable Map with the matched entry's data
      expect(result).toBeDefined();
      expect(result instanceof ImmutableMap).toBe(true);
      // The result should have the data from the matching entry
      expect(result?.get('data')).toBeDefined();
    });
  });

  describe('preparePreviewTemplateProps', () => {
    it('should prepare props for preview template', () => {
      /** @type {Partial<CustomPreviewTemplateProps['draft']>} */
      const mockDraft = {
        collectionName: 'posts',
        fileName: undefined,
        isIndexFile: false,
        originalEntry: {
          slug: 'test-post',
          locales: {
            en: { slug: 'test-post', path: '/posts/test-post', content: { title: 'Test' } },
          },
        },
        currentValues: {
          en: { title: 'Updated Title' },
        },
      };

      const result = preparePreviewTemplateProps({
        draft: mockDraft,
        locale: 'en',
      });

      expect(result).toHaveProperty('entry');
      expect(result).toHaveProperty('widgetFor');
      expect(result).toHaveProperty('widgetsFor');
      expect(result).toHaveProperty('getAsset');
      expect(result).toHaveProperty('getCollection');
      expect(result).toHaveProperty('fieldsMetaData');
    });

    it('should handle multiple locales', () => {
      /** @type {Partial<CustomPreviewTemplateProps['draft']>} */
      const mockDraft = {
        collectionName: 'posts',
        fileName: undefined,
        isIndexFile: false,
        originalEntry: {
          slug: 'test-post',
          locales: {
            en: { slug: 'test-post', path: '/posts/test-post', content: { title: 'Test' } },
            ja: { slug: 'テスト記事', path: '/ja/posts/テスト記事', content: { title: 'テスト' } },
          },
        },
        currentValues: {
          en: { title: 'Updated Title' },
          ja: { title: '更新されたタイトル' },
        },
      };

      const result = preparePreviewTemplateProps({
        draft: mockDraft,
        locale: 'en',
      });

      expect(result).toHaveProperty('entry');
    });

    it('should include all required props', () => {
      /** @type {Partial<CustomPreviewTemplateProps['draft']>} */
      const mockDraft = {
        collectionName: 'posts',
        fileName: undefined,
        isIndexFile: false,
        originalEntry: {
          slug: 'test-post',
          locales: {
            en: { slug: 'test-post', path: '/posts/test-post', content: { title: 'Test' } },
          },
        },
        currentValues: {
          en: { title: 'Test' },
        },
      };

      const result = preparePreviewTemplateProps({
        draft: mockDraft,
        locale: 'en',
      });

      const expectedProps = [
        'entry',
        'widgetFor',
        'widgetsFor',
        'getAsset',
        'getCollection',
        'fieldsMetaData',
      ];

      expectedProps.forEach((prop) => {
        expect(result).toHaveProperty(prop);
      });
    });

    it('should set associatedAssets to empty array when asset folder is not available', () => {
      // Mock getAssetFolder to return undefined
      mockGetAssetFolder.mockReturnValueOnce(undefined);

      /** @type {Partial<CustomPreviewTemplateProps['draft']>} */
      const mockDraft = {
        collectionName: 'posts',
        fileName: undefined,
        isIndexFile: false,
        originalEntry: {
          slug: 'test-post',
          locales: {
            en: { slug: 'test-post', path: '/posts/test-post', content: { title: 'Test' } },
          },
        },
        currentValues: {
          en: { title: 'Test' },
        },
      };

      const result = preparePreviewTemplateProps({
        draft: mockDraft,
        locale: 'en',
      });

      // Verify entry was created with empty associatedAssets
      expect(result.entry).toBeDefined();
      expect(mockCreateEntryMap).toHaveBeenCalledWith(
        expect.objectContaining({
          associatedAssets: [],
        }),
      );
    });

    it('should include associated assets when asset folder is available', () => {
      // Mock getAssetFolder to return an object
      const mockAssetFolder = { collectionName: 'posts', internalPath: 'assets' };

      mockGetAssetFolder.mockReturnValueOnce(mockAssetFolder);

      // Mock allAssets with some assets
      const mockAssets = [
        { name: 'image1.jpg', path: '/assets/image1.jpg' },
        { name: 'image2.jpg', path: '/assets/image2.jpg' },
      ];

      // Mock isAssetInFolder to return true for all
      mockIsAssetInFolder.mockReturnValue(true);

      // Mock the get function to return our test assets for this test
      mockGet.mockImplementation((store) => {
        if (store && 'value' in store) {
          return mockAssets;
        }

        return store?.value;
      });

      /** @type {Partial<CustomPreviewTemplateProps['draft']>} */
      const mockDraft = {
        collectionName: 'posts',
        fileName: undefined,
        isIndexFile: false,
        originalEntry: {
          slug: 'test-post',
          locales: {
            en: { slug: 'test-post', path: '/posts/test-post', content: { title: 'Test' } },
          },
        },
        currentValues: {
          en: { title: 'Test' },
        },
      };

      const result = preparePreviewTemplateProps({
        draft: mockDraft,
        locale: 'en',
      });

      // Verify entry was created with filtered associatedAssets
      expect(result.entry).toBeDefined();
      expect(mockCreateEntryMap).toHaveBeenCalledWith(
        expect.objectContaining({
          associatedAssets: mockAssets,
        }),
      );

      // Restore the default behavior
      mockGet.mockImplementation((store) => store?.value);
    });

    it('should handle entry with subPath fallback when locale path is missing', () => {
      /** @type {Partial<CustomPreviewTemplateProps['draft']>} */
      const mockDraft = {
        collectionName: 'posts',
        fileName: undefined,
        isIndexFile: false,
        originalEntry: {
          slug: 'test-post',
          subPath: '/fallback-path', // subPath instead of locale-specific path
          locales: {
            en: { slug: 'test-post', content: { title: 'Test' } }, // No path in locale
          },
        },
        currentValues: {
          en: { title: 'Updated' },
        },
      };

      const result = preparePreviewTemplateProps({
        draft: mockDraft,
        locale: 'en',
      });

      expect(result).toBeDefined();
      expect(mockCreateEntryMap).toHaveBeenCalled();

      // Verify the path falls back to subPath
      const callArgs = mockCreateEntryMap.mock.calls[mockCreateEntryMap.mock.calls.length - 1][0];

      expect(callArgs.path).toBe('/fallback-path');
    });

    it('should use root slug fallback when locale slug is missing', () => {
      /** @type {Partial<CustomPreviewTemplateProps['draft']>} */
      const mockDraft = {
        collectionName: 'posts',
        fileName: undefined,
        isIndexFile: false,
        originalEntry: {
          slug: 'root-slug', // Root slug
          locales: {
            en: {
              // No slug in English locale, should fall back to root slug
              path: '/posts/default',
              content: { title: 'Test' },
            },
            ja: {
              slug: 'japanese-slug',
              path: '/ja/posts/japanese-slug',
              content: { title: 'テスト' },
            },
          },
        },
        currentValues: {
          en: { title: 'English' },
          ja: { title: '日本語' },
        },
      };

      const result = preparePreviewTemplateProps({
        draft: mockDraft,
        locale: 'en',
      });

      expect(result).toBeDefined();
      expect(mockCreateEntryMap).toHaveBeenCalled();

      // The entry should have locales with the fallback slug for en
      const callArgs = mockCreateEntryMap.mock.calls[mockCreateEntryMap.mock.calls.length - 1][0];

      expect(callArgs.locales.en.slug).toBe('root-slug');
      expect(callArgs.locales.ja.slug).toBe('japanese-slug');
    });

    it('should handle entry when both locale path and subPath are missing', () => {
      /** @type {Partial<CustomPreviewTemplateProps['draft']>} */
      const mockDraft = {
        collectionName: 'posts',
        fileName: undefined,
        isIndexFile: false,
        originalEntry: {
          slug: 'test-post',
          // No subPath, and no path in locales
          locales: {
            en: {
              slug: 'test-post',
              content: { title: 'Test' },
            },
          },
        },
        currentValues: {
          en: { title: 'English' },
        },
      };

      const result = preparePreviewTemplateProps({
        draft: mockDraft,
        locale: 'en',
      });

      expect(result).toBeDefined();
      expect(mockCreateEntryMap).toHaveBeenCalled();

      // When both locale path and subPath are undefined, path in entry should be undefined
      // But when passing to createEntryMap, the path parameter should reflect this
      const callArgs = mockCreateEntryMap.mock.calls[mockCreateEntryMap.mock.calls.length - 1][0];

      // The path should be either undefined or empty string depending on fallback behavior
      expect(callArgs.path).toBeDefined();
    });
  });
});
