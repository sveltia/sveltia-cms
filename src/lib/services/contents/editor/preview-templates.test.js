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
  createWidgetFor,
  createWidgetsFor,
  createWidgetsMap,
  FieldWidget,
  getCollectionByName,
  mountFieldPreview,
  preparePreviewTemplateProps,
} from './preview-templates';

/**
 * Entry draft state of the editor, normally provided through the Svelte context.
 * @type {any}
 */
const mockEntryDraft = { current: { collectionName: 'posts', currentValues: { en: {} } } };

// Mock dependencies using vi.hoisted()
const {
  mockGetCollection,
  mockGetEntriesByCollection,
  mockGetField,
  mockConvertEntryToMap,
  mockCreateElement,
  mockUseLayoutEffect,
  mockBuildPreviewData,
} = vi.hoisted(() => ({
  mockGetCollection: vi.fn(() => ({
    _i18n: { defaultLocale: 'en' },
  })),
  mockGetEntriesByCollection: vi.fn(() => []),
  mockGetField: vi.fn(() => ({ widget: 'text' })),
  mockConvertEntryToMap: vi.fn(() => ({})),
  mockCreateElement: vi.fn((tag, props) => ({ type: tag, ...props })),
  mockUseLayoutEffect: vi.fn(),
  mockBuildPreviewData: vi.fn(() => ({
    entryMap: {},
    valueMap: {},
    getFieldArgs: {},
    fieldsMetaData: {},
    getAsset: vi.fn(),
  })),
}));

vi.mock('flat', () => ({
  unflatten: vi.fn((obj) => obj),
}));

vi.mock('react', () => ({
  createContext: vi.fn(() => ({})),
  createElement: mockCreateElement,
  useLayoutEffect: mockUseLayoutEffect,
  /**
   * Create a ref object.
   * @param {any} initialValue Initial value.
   * @returns {{ current: any }} Ref.
   */
  useRef: (initialValue) => ({ current: initialValue }),
}));

vi.mock('svelte', () => {
  const unmountFn = vi.fn();

  return {
    mount: vi.fn(() => ({ destroy: vi.fn() })),
    unmount: unmountFn,
  };
});

vi.mock('$lib/components/contents/details/preview/field-preview.svelte', () => ({
  default: {},
}));

vi.mock('$lib/services/api/preview-data', () => ({
  convertEntryToMap: mockConvertEntryToMap,
  buildPreviewData: mockBuildPreviewData,
  getAssociatedPreviewAssets: vi.fn(() => []),
}));

vi.mock('$lib/services/contents/collection', () => ({
  getCollection: mockGetCollection,
}));

vi.mock('$lib/services/contents/collection/entries', () => ({
  getEntriesByCollection: mockGetEntriesByCollection,
}));

vi.mock('$lib/services/contents/entry/fields', () => ({
  getField: mockGetField,
}));

// The library is loaded from the CDN at runtime; hand the real module to the code under test
vi.mock('$lib/services/api/immutable', async () => {
  const immutable = /** @type {typeof import('immutable')} */ (await vi.importActual('immutable'));

  return {
    /**
     * Get the preloaded Immutable module.
     * @returns {typeof import('immutable')} Immutable module.
     */
    getImmutable: () => immutable,
    loadImmutable: vi.fn(async () => immutable),
    preloadImmutable: vi.fn(),
    immutableLoaded: { current: true },
  };
});

describe('Preview Templates', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetCollection.mockReturnValue({
      _i18n: { defaultLocale: 'en' },
    });
    mockGetEntriesByCollection.mockReturnValue([]);
    mockGetField.mockReturnValue({ widget: 'text' });
    mockConvertEntryToMap.mockImplementation(({ entry, locale, collectionName, content }) =>
      ImmutableMap({
        data: ImmutableMap(content ?? entry?.locales?.[locale]?.content ?? {}),
        slug: entry?.slug ?? '',
        path: entry?.locales?.[locale]?.path ?? '',
        collection: collectionName ?? '',
        newRecord: false,
        meta: ImmutableMap({ path: entry?.locales?.[locale]?.path ?? '' }),
      }),
    );
    mockBuildPreviewData.mockImplementation(({ draft, locale }) => {
      const { originalEntry, currentValues, collectionName, fileName, isIndexFile } = draft;
      const valueMap = currentValues?.[locale] ?? {};

      const entryMap = mockConvertEntryToMap({
        entry: originalEntry,

        locale,
        collectionName,
        associatedAssets: [],
        content: valueMap,
      });

      return {
        entryMap,
        valueMap,
        getFieldArgs: { collectionName, fileName, valueMap, isIndexFile },
        fieldsMetaData: ImmutableMap({}),
        getAsset: vi.fn(),
      };
    });
  });

  describe('mountFieldPreview', () => {
    it('should provide the entry draft state to the mounted component as a context', () => {
      const entryDraft = { current: { collectionName: 'posts' } };
      /** @type {any} */
      const target = {};
      /** @type {any} */
      const fieldConfig = { name: 'title', widget: 'text' };

      mountFieldPreview({ target, entryDraft, locale: 'en', keyPath: 'title', fieldConfig });

      expect(vi.mocked(svelte.mount)).toHaveBeenCalledTimes(1);

      const [, options] = vi.mocked(svelte.mount).mock.calls[0];

      // The component is mounted outside the Svelte component tree, so `getEntryDraftContext()` in
      // the component only works if the state is passed as a mount context
      expect(options.target).toBe(target);
      expect(options.context).toBeInstanceOf(Map);
      expect(options.context.get('entry-draft')).toBe(entryDraft);
      expect(options.props).toEqual({
        keyPath: 'title',
        typedKeyPath: '',
        locale: 'en',
        fieldConfig,
        showLabel: false,
      });
    });
  });

  describe('FieldWidget', () => {
    it('should mount the field preview into its div until the dependencies change', () => {
      const component = { destroy: vi.fn() };
      const entryDraft = { current: { collectionName: 'posts' } };
      /** @type {any} */
      const fieldConfig = { name: 'title', widget: 'text' };

      vi.mocked(svelte.mount).mockReturnValue(component);

      const element = /** @type {any} */ (
        FieldWidget(
          /** @type {any} */ ({ entryDraft, locale: 'en', keyPath: 'title', fieldConfig }),
        )
      );

      expect(element.type).toBe('div');
      expect(svelte.mount).not.toHaveBeenCalled();

      const [effect, dependencies] = mockUseLayoutEffect.mock.calls[0];

      // React only runs the effect again, mounting the preview again, when one of these changes
      expect(dependencies).toEqual([entryDraft, 'en', 'title', fieldConfig]);

      /** @type {any} */
      const div = {};

      element.ref.current = div;

      const cleanup = effect();

      expect(vi.mocked(svelte.mount).mock.calls[0][1].target).toBe(div);
      expect(vi.mocked(svelte.mount).mock.calls[0][1].props.keyPath).toBe('title');
      expect(svelte.unmount).not.toHaveBeenCalled();

      cleanup();

      expect(svelte.unmount).toHaveBeenCalledWith(component);
    });
  });

  describe('createWidgetFor', () => {
    /** @type {any} */
    const getFieldArgs = { collectionName: 'posts', valueMap: {} };
    /** @type {any} */
    const entryDraft = { current: { collectionName: 'posts' } };

    it('should return a widget factory function', () => {
      const widgetFor = createWidgetFor({ entryDraft, locale: 'en', getFieldArgs });

      expect(typeof widgetFor).toBe('function');
    });

    it('should create a field widget element', () => {
      const widgetFor = createWidgetFor({ entryDraft, locale: 'en', getFieldArgs });
      const element = /** @type {any} */ (widgetFor('field.name'));

      expect(element).toEqual({
        type: FieldWidget,
        entryDraft,
        locale: 'en',
        keyPath: 'field.name',
        fieldConfig: { widget: 'text' },
      });
      expect(mockGetField).toHaveBeenCalledWith({ ...getFieldArgs, keyPath: 'field.name' });
      expect(svelte.mount).not.toHaveBeenCalled();
    });

    it('should create elements of the same component each time the template renders', () => {
      // The props are prepared again on every change to the entry. A new component, or a new ref
      // callback, would make React mount the field preview again each time
      const first = /** @type {any} */ (
        createWidgetFor({ entryDraft, locale: 'en', getFieldArgs })('field.name')
      );

      const second = /** @type {any} */ (
        createWidgetFor({ entryDraft, locale: 'en', getFieldArgs })('field.name')
      );

      expect(second.type).toBe(first.type);
      expect(second).toEqual(first);
    });

    it('should return `null` for a key path without a field configuration', () => {
      const widgetFor = createWidgetFor({ entryDraft, locale: 'en', getFieldArgs });

      mockGetField.mockReturnValueOnce(/** @type {any} */ (undefined));

      expect(widgetFor('missing')).toBeNull();
      expect(mockCreateElement).not.toHaveBeenCalled();
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

    it('should leave out the keys without a field configuration', () => {
      /** @type {any} */
      const mockWidgetFor = vi.fn((keyPath) =>
        keyPath === 'article.title' ? { path: keyPath } : null,
      );

      const result = createWidgetsMap({ title: 'test', extra: 'x' }, 'article', mockWidgetFor);

      expect(result.toJS()).toEqual({ title: { path: 'article.title' } });
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

    it('should use convertEntryToMap to preserve entry props for preview templates', async () => {
      /** @type {Partial<Entry>} */
      const mockEntry = {
        slug: 'test-entry',
        locales: { en: { content: { title: 'Test Entry' }, path: '/posts/test-entry' } },
      };

      mockGetCollection.mockReturnValue({
        _i18n: { defaultLocale: 'en' },
      });
      mockGetEntriesByCollection.mockReturnValue([mockEntry]);

      const result = await getCollectionByName('posts', 'test-entry');

      expect(mockConvertEntryToMap).toHaveBeenCalledWith(
        expect.objectContaining({
          collectionName: 'posts',
          associatedAssets: [],
        }),
      );
      expect(result?.get('slug')).toBe('test-entry');
      expect(result?.get('collection')).toBe('posts');
      expect(result?.get('path')).toBe('/posts/test-entry');
    });

    it('should populate associated assets when resolving collection entries', async () => {
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

      expect(mockConvertEntryToMap).toHaveBeenCalled();
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

    it('should handle entries with missing properties gracefully', async () => {
      /** @type {Partial<Entry>} */
      const mockEntry = {
        // No slug property
        locales: { en: { content: { title: 'Entry' } } }, // No path property
      };

      mockGetCollection.mockReturnValueOnce({
        _i18n: { defaultLocale: 'en' },
      });
      mockGetEntriesByCollection.mockReturnValueOnce([mockEntry]);

      const result = await getCollectionByName('posts');

      expect(result).toBeDefined();
      expect(mockConvertEntryToMap).toHaveBeenCalled();
    });

    it('should handle entries without locales property', async () => {
      /** @type {Partial<Entry>} */
      const mockEntry = {
        slug: 'test-entry',
        // No locales property
      };

      mockGetCollection.mockReturnValueOnce({
        _i18n: { defaultLocale: 'en' },
      });
      mockGetEntriesByCollection.mockReturnValueOnce([mockEntry]);

      const result = await getCollectionByName('posts');

      expect(result).toBeDefined();
      expect(mockConvertEntryToMap).toHaveBeenCalled();
    });

    it('should handle undefined entry when slug not found', async () => {
      mockGetCollection.mockReturnValueOnce({
        _i18n: { defaultLocale: 'en' },
      });
      mockGetEntriesByCollection.mockReturnValueOnce([]);

      const result = await getCollectionByName('posts', 'nonexistent-slug');

      expect(result).toBeDefined();
      expect(mockConvertEntryToMap).toHaveBeenCalled();
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
        entryDraft: mockEntryDraft,
        draft: mockDraft,
        locale: 'en',
      });

      expect(mockBuildPreviewData).toHaveBeenCalledWith({
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

    it('should mount field previews for `widgetFor()` with the entry draft state', () => {
      const entryDraft = { current: { collectionName: 'posts' } };

      const { widgetFor } = preparePreviewTemplateProps({
        entryDraft,
        draft: {
          collectionName: 'posts',
          fileName: undefined,
          isIndexFile: false,
          originalEntry: { slug: 'test-post', locales: {} },
          currentValues: { en: { title: 'Test' } },
        },
        locale: 'en',
      });

      const element = /** @type {any} */ (widgetFor('title'));

      expect(element.type).toBe(FieldWidget);
      expect(element.entryDraft).toBe(entryDraft);
      expect(element.locale).toBe('en');
      expect(mockGetField).toHaveBeenCalledWith({
        collectionName: 'posts',
        fileName: undefined,
        valueMap: { title: 'Test' },
        isIndexFile: false,
        keyPath: 'title',
      });
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
        entryDraft: mockEntryDraft,
        draft: mockDraft,
        locale: 'en',
      });

      expect(mockBuildPreviewData).toHaveBeenCalledWith({
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
        entryDraft: mockEntryDraft,
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
        entryDraft: mockEntryDraft,
        draft: mockDraft,
        locale: 'en',
      });

      // Verify the result has all required properties
      expect(result.entry).toBeDefined();
      expect(result.widgetFor).toBeDefined();
      expect(result.widgetsFor).toBeDefined();
      expect(result.getAsset).toBeDefined();
    });

    it('should include associated assets when asset folder is available', () => {
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
        entryDraft: mockEntryDraft,
        draft: mockDraft,
        locale: 'en',
      });

      // Verify entry was created
      expect(result.entry).toBeDefined();
      expect(mockBuildPreviewData).toHaveBeenCalled();
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
        entryDraft: mockEntryDraft,
        draft: mockDraft,
        locale: 'en',
      });

      expect(result).toBeDefined();
      expect(mockBuildPreviewData).toHaveBeenCalledWith({
        draft: mockDraft,
        locale: 'en',
      });
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
        entryDraft: mockEntryDraft,
        draft: mockDraft,
        locale: 'en',
      });

      expect(result).toBeDefined();
      expect(mockBuildPreviewData).toHaveBeenCalledWith({
        draft: mockDraft,
        locale: 'en',
      });
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
        entryDraft: mockEntryDraft,
        draft: mockDraft,
        locale: 'en',
      });

      expect(result).toBeDefined();
      expect(mockBuildPreviewData).toHaveBeenCalledWith({
        draft: mockDraft,
        locale: 'en',
      });
    });
  });
});
