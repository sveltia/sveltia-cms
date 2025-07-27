import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  allAssets,
  editingAsset,
  focusedAsset,
  getAsset,
  getAssetByAbsolutePath,
  getAssetByPath,
  getAssetByRelativePath,
  getAssetsByDirName,
  getAssetsByFolder,
  overlaidAsset,
  processedAssets,
  renamingAsset,
  selectedAssets,
  uploadingAssets,
} from './index';

// Mock all dependencies
vi.mock('@sveltia/utils/file');
vi.mock('@sveltia/utils/string');
vi.mock('fast-deep-equal');
vi.mock('flat');
vi.mock('$lib/services/integrations/media-libraries/default');
vi.mock('$lib/services/common/slug');
vi.mock('$lib/services/contents/collection');
vi.mock('$lib/services/contents/collection/files');
vi.mock('$lib/services/contents/collection/index-file');
vi.mock('$lib/services/contents/entry');
vi.mock('$lib/services/utils/file');

// Mock folders module with real stores for testing side effects
vi.mock('$lib/services/assets/folders', async () => {
  const { writable } = await import('svelte/store');

  return {
    allAssetFolders: writable([]),
    globalAssetFolder: writable({}),
    selectedAssetFolder: writable(),
    targetAssetFolder: writable({}),
    getAssetFolder: vi.fn(),
  };
});

describe('assets/index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset all stores
    allAssets.set([]);
    selectedAssets.set([]);
    focusedAsset.set(undefined);
    overlaidAsset.set(undefined);
    uploadingAssets.set({ folder: undefined, files: [] });
    editingAsset.set(undefined);
    renamingAsset.set(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('stores initialization', () => {
    it('should initialize allAssets as empty array', () => {
      expect(get(allAssets)).toEqual([]);
    });

    it('should initialize selectedAssets as empty array', () => {
      expect(get(selectedAssets)).toEqual([]);
    });

    it('should initialize focusedAsset as undefined', () => {
      expect(get(focusedAsset)).toBeUndefined();
    });

    it('should initialize overlaidAsset as undefined', () => {
      expect(get(overlaidAsset)).toBeUndefined();
    });

    it('should initialize uploadingAssets with correct structure', () => {
      expect(get(uploadingAssets)).toEqual({
        folder: undefined,
        files: [],
      });
    });

    it('should initialize editingAsset as undefined', () => {
      expect(get(editingAsset)).toBeUndefined();
    });

    it('should initialize renamingAsset as undefined', () => {
      expect(get(renamingAsset)).toBeUndefined();
    });
  });

  describe('processedAssets derived store', () => {
    /**
     * @type {import('vitest').MockedFunction<typeof
     * import('$lib/services/integrations/media-libraries/default').getDefaultMediaLibraryOptions
     * >}
     */
    let getDefaultMediaLibraryOptionsMock;
    /**
     * @type {import('vitest').MockedFunction<
     * typeof import('$lib/services/integrations/media-libraries/default').transformFile
     * >}
     */
    let transformFileMock;

    beforeEach(async () => {
      const { getDefaultMediaLibraryOptions, transformFile } = await import(
        '$lib/services/integrations/media-libraries/default'
      );

      getDefaultMediaLibraryOptionsMock = vi.mocked(getDefaultMediaLibraryOptions);
      transformFileMock = vi.mocked(transformFile);

      getDefaultMediaLibraryOptionsMock.mockReturnValue({
        config: {
          max_file_size: 1000000, // 1MB
          transformations: undefined,
        },
      });
    });

    it('should initialize with correct default state', () => {
      const result = get(processedAssets);

      expect(result).toEqual({
        processing: false,
        undersizedFiles: [],
        oversizedFiles: [],
        transformedFileMap: expect.any(WeakMap),
      });
    });

    it('should categorize files by size without transformations', async () => {
      const smallFile = new File(['small'], 'small.txt', { type: 'text/plain' });

      const largeFile = new File(['large content '.repeat(100000)], 'large.txt', {
        type: 'text/plain',
      });

      // Set small file size manually for testing
      Object.defineProperty(smallFile, 'size', { value: 500000 });
      Object.defineProperty(largeFile, 'size', { value: 1500000 });

      uploadingAssets.set({
        folder: undefined,
        files: [smallFile, largeFile],
      });

      // Wait for async processing
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });

      const result = get(processedAssets);

      expect(result.processing).toBe(false);
      expect(result.undersizedFiles).toEqual([smallFile]);
      expect(result.oversizedFiles).toEqual([largeFile]);
    });

    it('should handle file transformations', async () => {
      const originalFile = new File(['content'], 'original.jpg', { type: 'image/jpeg' });
      const transformedFile = new File(['transformed'], 'transformed.jpg', { type: 'image/jpeg' });

      Object.defineProperty(originalFile, 'size', { value: 500000 });
      Object.defineProperty(transformedFile, 'size', { value: 300000 });

      getDefaultMediaLibraryOptionsMock.mockReturnValue({
        config: {
          max_file_size: 1000000,
          transformations: undefined,
        },
      });

      transformFileMock.mockResolvedValue(transformedFile);

      uploadingAssets.set({
        folder: undefined,
        files: [originalFile],
      });

      // Wait for async processing to complete
      await new Promise((resolve) => {
        setTimeout(resolve, 50);
      });

      const result = get(processedAssets);

      expect(result.processing).toBe(false);
      // original file since no transformations
      expect(result.undersizedFiles).toEqual([originalFile]);
      expect(transformFileMock).not.toHaveBeenCalled();
    });

    it('should set processing state during transformations', async () => {
      const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });

      getDefaultMediaLibraryOptionsMock.mockReturnValue({
        config: {
          max_file_size: 1000000,
          transformations: undefined,
        },
      });

      transformFileMock.mockResolvedValue(file);

      uploadingAssets.set({
        folder: undefined,
        files: [file],
      });

      // Since transformations is undefined, processing should remain false
      await new Promise((resolve) => {
        setTimeout(() => {
          const result = get(processedAssets);

          expect(result.processing).toBe(false);
          resolve(undefined);
        }, 5);
      });

      // Wait for processing to complete
      await new Promise((resolve) => {
        setTimeout(resolve, 20);
      });

      const finalResult = get(processedAssets);

      expect(finalResult.processing).toBe(false);
    });
  });

  describe('getAssetByPath', () => {
    let decodeFilePathMock;

    beforeEach(async () => {
      const { decodeFilePath } = await import('$lib/services/utils/file');

      decodeFilePathMock = vi.mocked(decodeFilePath);
      decodeFilePathMock.mockImplementation((path) => path); // Default passthrough
    });

    it('should handle absolute paths', async () => {
      const { stripSlashes } = await import('@sveltia/utils/string');
      const stripSlashesMock = vi.mocked(stripSlashes);

      stripSlashesMock.mockReturnValue('/assets/image.jpg');

      const mockAsset = {
        path: '/assets/image.jpg',
        name: 'image.jpg',
        kind: /** @type {import('$lib/types/private').AssetKind} */ ('image'),
        sha: 'abc123',
        size: 1024,
        folder: {
          internalPath: 'assets',
          publicPath: '/assets',
          collectionName: undefined,
          entryRelative: false,
          hasTemplateTags: false,
        },
      };

      allAssets.set([mockAsset]);

      const result = getAssetByPath({
        value: '/assets/image.jpg',
        collectionName: 'posts',
      });

      expect(result).toEqual(mockAsset);
      expect(stripSlashesMock).toHaveBeenCalledWith('/assets/image.jpg');
    });

    it('should handle relative paths with entry', async () => {
      const { resolvePath } = await import('$lib/services/utils/file');
      const { getAssociatedCollections } = await import('$lib/services/contents/entry');
      const { getCollectionFilesByEntry } = await import('$lib/services/contents/collection/files');
      const resolvePathMock = vi.mocked(resolvePath);
      const getAssociatedCollectionsMock = vi.mocked(getAssociatedCollections);
      const getCollectionFilesByEntryMock = vi.mocked(getCollectionFilesByEntry);

      const mockEntry = /** @type {any} */ ({
        slug: 'test-post',
        id: 'test-post',
        subPath: 'test-post.md',
        locales: {
          en: {
            path: 'content/posts/test-post.md',
            content: { title: 'Test Post' },
          },
        },
      });

      const mockCollection = /** @type {any} */ ({
        name: 'posts',
        _i18n: { defaultLocale: 'en' },
      });

      const mockAsset = {
        path: 'content/posts/image.jpg',
        name: 'image.jpg',
        kind: /** @type {import('$lib/types/private').AssetKind} */ ('image'),
        sha: 'abc123',
        size: 1024,
        folder: {
          internalPath: 'content/posts',
          publicPath: '/posts',
          collectionName: 'posts',
          entryRelative: false,
          hasTemplateTags: false,
        },
      };

      allAssets.set([mockAsset]);
      resolvePathMock.mockReturnValue('content/posts/image.jpg');
      getAssociatedCollectionsMock.mockReturnValue([mockCollection]);
      getCollectionFilesByEntryMock.mockReturnValue([]);

      const result = getAssetByPath({
        value: 'image.jpg',
        entry: mockEntry,
        collectionName: 'posts',
      });

      expect(result).toEqual(mockAsset);
    });

    it('should return undefined for relative path without entry', () => {
      const result = getAssetByPath({
        value: 'image.jpg',
        collectionName: 'posts',
      });

      expect(result).toBeUndefined();
    });

    it('should handle @ prefixed paths as absolute', async () => {
      const { stripSlashes } = await import('@sveltia/utils/string');
      const stripSlashesMock = vi.mocked(stripSlashes);

      stripSlashesMock.mockReturnValue('@assets/image.jpg');

      const mockAsset = {
        path: '@assets/image.jpg',
        name: 'image.jpg',
        kind: /** @type {import('$lib/types/private').AssetKind} */ ('image'),
        sha: 'abc123',
        size: 1024,
        folder: {
          internalPath: 'assets',
          publicPath: '/@assets',
          collectionName: undefined,
          entryRelative: false,
          hasTemplateTags: false,
        },
      };

      allAssets.set([mockAsset]);

      const result = getAssetByPath({
        value: '@assets/image.jpg',
        collectionName: 'posts',
      });

      expect(result).toEqual(mockAsset);
    });
  });

  describe('getAssetsByFolder', () => {
    it('should return assets matching the folder', async () => {
      const { default: equal } = await import('fast-deep-equal');
      const equalMock = vi.mocked(equal);

      const folder = {
        internalPath: 'assets',
        publicPath: '/assets',
        collectionName: undefined,
        entryRelative: false,
        hasTemplateTags: false,
      };

      const matchingAsset = {
        path: 'assets/image.jpg',
        name: 'image.jpg',
        kind: /** @type {import('$lib/types/private').AssetKind} */ ('image'),
        sha: 'abc123',
        size: 1024,
        folder,
      };

      const nonMatchingAsset = {
        path: 'content/other.jpg',
        name: 'other.jpg',
        kind: /** @type {import('$lib/types/private').AssetKind} */ ('image'),
        sha: 'def456',
        size: 2048,
        folder: {
          internalPath: 'content',
          publicPath: '/content',
          collectionName: 'posts',
          entryRelative: false,
          hasTemplateTags: false,
        },
      };

      allAssets.set([matchingAsset, nonMatchingAsset]);

      // Mock equal to return true only for the matching folder
      equalMock.mockImplementation((a, b) => a === b);

      const result = getAssetsByFolder(folder);

      expect(result).toEqual([matchingAsset]);
    });

    it('should return empty array when no assets match', async () => {
      const { default: equal } = await import('fast-deep-equal');
      const equalMock = vi.mocked(equal);

      const folder = {
        internalPath: 'nonexistent',
        publicPath: '/nonexistent',
        collectionName: undefined,
        entryRelative: false,
        hasTemplateTags: false,
      };

      const asset = {
        path: 'assets/image.jpg',
        name: 'image.jpg',
        kind: /** @type {import('$lib/types/private').AssetKind} */ ('image'),
        sha: 'abc123',
        size: 1024,
        folder: {
          internalPath: 'assets',
          publicPath: '/assets',
          collectionName: undefined,
          entryRelative: false,
          hasTemplateTags: false,
        },
      };

      allAssets.set([asset]);
      equalMock.mockReturnValue(false);

      const result = getAssetsByFolder(folder);

      expect(result).toEqual([]);
    });
  });

  describe('getAssetsByDirName', () => {
    /** @type {any} */
    let getPathInfoMock;

    beforeEach(async () => {
      const { getPathInfo } = await import('@sveltia/utils/file');

      getPathInfoMock = vi.mocked(getPathInfo);
    });

    it('should return assets from the specified directory', () => {
      const asset1 = {
        path: 'assets/images/photo.jpg',
        name: 'photo.jpg',
        kind: /** @type {import('$lib/types/private').AssetKind} */ ('image'),
        sha: 'abc123',
        size: 1024,
        folder: {
          internalPath: 'assets/images',
          publicPath: '/assets/images',
          collectionName: undefined,
          entryRelative: false,
          hasTemplateTags: false,
        },
      };

      const asset2 = {
        path: 'assets/images/icon.png',
        name: 'icon.png',
        kind: /** @type {import('$lib/types/private').AssetKind} */ ('image'),
        sha: 'def456',
        size: 512,
        folder: {
          internalPath: 'assets/images',
          publicPath: '/assets/images',
          collectionName: undefined,
          entryRelative: false,
          hasTemplateTags: false,
        },
      };

      const asset3 = {
        path: 'content/docs/file.pdf',
        name: 'file.pdf',
        kind: /** @type {import('$lib/types/private').AssetKind} */ ('document'),
        sha: 'ghi789',
        size: 2048,
        folder: {
          internalPath: 'content/docs',
          publicPath: '/docs',
          collectionName: 'docs',
          entryRelative: false,
          hasTemplateTags: false,
        },
      };

      allAssets.set([asset1, asset2, asset3]);

      getPathInfoMock.mockImplementation((/** @type {string} */ path) => {
        if (path === 'assets/images/photo.jpg') return { dirname: 'assets/images' };
        if (path === 'assets/images/icon.png') return { dirname: 'assets/images' };
        if (path === 'content/docs/file.pdf') return { dirname: 'content/docs' };
        return { dirname: '' };
      });

      const result = getAssetsByDirName('assets/images');

      expect(result).toEqual([asset1, asset2]);
    });

    it('should return empty array when no assets match directory', () => {
      const asset = {
        path: 'assets/images/photo.jpg',
        name: 'photo.jpg',
        kind: /** @type {import('$lib/types/private').AssetKind} */ ('image'),
        sha: 'abc123',
        size: 1024,
        folder: {
          internalPath: 'assets/images',
          publicPath: '/assets/images',
          collectionName: undefined,
          entryRelative: false,
          hasTemplateTags: false,
        },
      };

      allAssets.set([asset]);

      getPathInfoMock.mockReturnValue({ dirname: 'assets/images' });

      const result = getAssetsByDirName('content/docs');

      expect(result).toEqual([]);
    });
  });

  describe('store side effects', () => {
    it('should reset focusedAsset when selectedAssetFolder changes', async () => {
      const { selectedAssetFolder } = await import('$lib/services/assets/folders');

      const mockAsset = {
        path: 'assets/image.jpg',
        name: 'image.jpg',
        kind: /** @type {import('$lib/types/private').AssetKind} */ ('image'),
        sha: 'abc123',
        size: 1024,
        folder: {
          internalPath: 'assets',
          publicPath: '/assets',
          collectionName: undefined,
          entryRelative: false,
          hasTemplateTags: false,
        },
      };

      // Set focusedAsset to a value
      focusedAsset.set(mockAsset);
      expect(get(focusedAsset)).toBe(mockAsset);

      // Change selectedAssetFolder to trigger the subscription callback
      selectedAssetFolder.set(
        /** @type {any} */ ({
          internalPath: 'different',
          publicPath: '/different',
        }),
      );

      // focusedAsset should be reset to undefined
      expect(get(focusedAsset)).toBe(undefined);
    });
  });

  describe('getAsset', () => {
    it('should find asset by resolved path', async () => {
      const { resolvePath } = await import('$lib/services/utils/file');

      const mockAsset = {
        path: 'content/posts/images/photo.jpg',
        name: 'photo.jpg',
        sha: 'abc123',
        size: 1024,
        kind: /** @type {import('$lib/types/private').AssetKind} */ ('image'),
        folder: {
          internalPath: 'content/posts/images',
          publicPath: '/images',
          collectionName: 'posts',
          entryRelative: false,
          hasTemplateTags: false,
        },
      };

      const mockEntry = /** @type {any} */ ({
        id: 'my-post',
        slug: 'my-post',
        subPath: 'my-post.md',
        locales: {
          en: {
            path: 'content/posts/my-post.md',
            sha: 'sha123',
            slug: 'my-post',
            content: { title: 'My Post' },
          },
        },
      });

      const mockI18n = /** @type {any} */ ({
        defaultLocale: 'en',
        i18nEnabled: true,
        allLocales: ['en'],
        initialLocales: ['en'],
        structure: 'multiple-files',
        canonicalSlug: { key: 'slug', value: '{{slug}}' },
        omitDefaultLocaleFromFileName: false,
        structureMap: {},
      });

      vi.mocked(resolvePath).mockReturnValue('content/posts/images/photo.jpg');
      allAssets.set([mockAsset]);

      const result = getAsset({
        path: 'images/photo.jpg',
        entry: mockEntry,
        _i18n: mockI18n,
      });

      expect(result).toEqual(mockAsset);
      expect(resolvePath).toHaveBeenCalledWith('content/posts/images/photo.jpg');
    });

    it('should return undefined when entry has no content', () => {
      const mockEntry = /** @type {any} */ ({
        id: 'my-post',
        slug: 'my-post',
        subPath: 'my-post.md',
        locales: {
          en: {
            path: 'content/posts/my-post.md',
            sha: 'sha123',
            slug: 'my-post',
            content: undefined,
          },
        },
      });

      const mockI18n = /** @type {any} */ ({
        defaultLocale: 'en',
        i18nEnabled: true,
        allLocales: ['en'],
        initialLocales: ['en'],
        structure: 'multiple-files',
        canonicalSlug: { key: 'slug', value: '{{slug}}' },
        omitDefaultLocaleFromFileName: false,
        structureMap: {},
      });

      const result = getAsset({
        path: 'images/photo.jpg',
        entry: mockEntry,
        _i18n: mockI18n,
      });

      expect(result).toBeUndefined();
    });

    it('should handle missing default locale by using first available', async () => {
      const { resolvePath } = await import('$lib/services/utils/file');

      const mockEntry = /** @type {any} */ ({
        id: 'mi-post',
        slug: 'mi-post',
        subPath: 'mi-post.md',
        locales: {
          es: {
            path: 'content/posts/mi-post.md',
            sha: 'sha123',
            slug: 'mi-post',
            content: { title: 'Mi Post' },
          },
        },
      });

      const mockI18n = /** @type {any} */ ({
        defaultLocale: 'en',
        i18nEnabled: true,
        allLocales: ['en', 'es'],
        initialLocales: ['en', 'es'],
        structure: 'multiple-files',
        canonicalSlug: { key: 'slug', value: '{{slug}}' },
        omitDefaultLocaleFromFileName: false,
        structureMap: {},
      });

      vi.mocked(resolvePath).mockReturnValue('content/posts/images/photo.jpg');
      allAssets.set([]);

      getAsset({
        path: 'images/photo.jpg',
        entry: mockEntry,
        _i18n: mockI18n,
      });

      expect(resolvePath).toHaveBeenCalledWith('content/posts/images/photo.jpg');
    });
  });

  describe('getAssetByRelativePath', () => {
    it('should return undefined when no entry provided', () => {
      const result = getAssetByRelativePath({
        path: 'images/photo.jpg',
        entry: undefined,
      });

      expect(result).toBeUndefined();
    });

    it('should find asset from associated collections', async () => {
      const { getAssociatedCollections } = await import('$lib/services/contents/entry');
      const { getCollectionFilesByEntry } = await import('$lib/services/contents/collection/files');

      const mockEntry = /** @type {any} */ ({
        id: 'my-post',
        slug: 'my-post',
        subPath: 'my-post.md',
        locales: {
          en: {
            path: 'content/posts/my-post.md',
            sha: 'sha123',
            slug: 'my-post',
            content: { title: 'My Post' },
          },
        },
      });

      const mockCollection = /** @type {any} */ ({
        name: 'posts',
        _type: 'entry',
        _i18n: {
          defaultLocale: 'en',
          i18nEnabled: true,
          allLocales: ['en'],
          initialLocales: ['en'],
          structure: 'multiple-files',
          canonicalSlug: { key: 'slug', value: '{{slug}}' },
          omitDefaultLocaleFromFileName: false,
          structureMap: {},
        },
      });

      vi.mocked(getAssociatedCollections).mockReturnValue([mockCollection]);
      vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
      allAssets.set([]); // Simulate no exact match found

      const result = getAssetByRelativePath({
        path: 'images/photo.jpg',
        entry: mockEntry,
      });

      expect(getAssociatedCollections).toHaveBeenCalledWith(mockEntry);
      expect(result).toBeUndefined(); // Since no assets found
    });

    it('should fall back to exact match at root folder', async () => {
      const { getAssociatedCollections } = await import('$lib/services/contents/entry');
      const { getCollectionFilesByEntry } = await import('$lib/services/contents/collection/files');

      const mockAsset = {
        path: 'photo.jpg',
        name: 'photo.jpg',
        sha: 'abc123',
        size: 1024,
        kind: /** @type {import('$lib/types/private').AssetKind} */ ('image'),
        folder: {
          internalPath: '',
          publicPath: '',
          collectionName: undefined,
          entryRelative: false,
          hasTemplateTags: false,
        },
      };

      const mockEntry = /** @type {any} */ ({
        id: 'my-post',
        slug: 'my-post',
        subPath: 'my-post.md',
        locales: {
          en: {
            path: 'content/posts/my-post.md',
            sha: 'sha123',
            slug: 'my-post',
            content: { title: 'My Post' },
          },
        },
      });

      const mockCollection = /** @type {any} */ ({
        name: 'posts',
        _type: 'entry',
        _i18n: {
          defaultLocale: 'en',
          i18nEnabled: true,
          allLocales: ['en'],
          initialLocales: ['en'],
          structure: 'multiple-files',
          canonicalSlug: { key: 'slug', value: '{{slug}}' },
          omitDefaultLocaleFromFileName: false,
          structureMap: {},
        },
      });

      vi.mocked(getAssociatedCollections).mockReturnValue([mockCollection]);
      vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);

      // Set up assets so that fallback exact match finds the asset
      allAssets.set([mockAsset]);

      const result = getAssetByRelativePath({
        path: 'photo.jpg',
        entry: mockEntry,
      });

      expect(result).toEqual(mockAsset);
    });
  });

  describe('getAssetByAbsolutePath', () => {
    it('should return exact match when found', async () => {
      const { stripSlashes } = await import('@sveltia/utils/string');

      const mockAsset = {
        path: '/assets/images/photo.jpg',
        name: 'photo.jpg',
        sha: 'abc123',
        size: 1024,
        kind: /** @type {import('$lib/types/private').AssetKind} */ ('image'),
        folder: {
          internalPath: 'assets/images',
          publicPath: '/assets/images',
          collectionName: undefined,
          entryRelative: false,
          hasTemplateTags: false,
        },
      };

      vi.mocked(stripSlashes).mockReturnValue('/assets/images/photo.jpg');
      allAssets.set([mockAsset]);

      const result = getAssetByAbsolutePath({
        path: '/assets/images/photo.jpg',
        entry: undefined,
        collectionName: 'posts',
        fileName: undefined,
      });

      expect(result).toEqual(mockAsset);
    });

    it('should search in collection folders when no exact match', async () => {
      const { stripSlashes } = await import('@sveltia/utils/string');
      const { getPathInfo } = await import('@sveltia/utils/file');
      const { getAssetFolder } = await import('$lib/services/assets/folders');

      const mockAsset = {
        path: 'content/posts/images/photo.jpg',
        name: 'photo.jpg',
        sha: 'abc123',
        size: 1024,
        kind: /** @type {import('$lib/types/private').AssetKind} */ ('image'),
        folder: {
          internalPath: 'content/posts/images',
          publicPath: '/posts/images',
          collectionName: 'posts',
          entryRelative: false,
          hasTemplateTags: false,
        },
      };

      const mockFolder = {
        internalPath: 'content/posts/images',
        publicPath: '/posts/images',
        collectionName: 'posts',
        entryRelative: false,
        hasTemplateTags: false,
      };

      vi.mocked(stripSlashes).mockReturnValue('/posts/images/photo.jpg');
      vi.mocked(getPathInfo).mockReturnValue({
        dirname: '/posts/images',
        basename: 'photo.jpg',
        filename: 'photo',
        extension: '.jpg',
      });
      vi.mocked(getAssetFolder).mockReturnValue(mockFolder);

      const { createPath } = await import('$lib/services/utils/file');

      vi.mocked(createPath).mockReturnValue('content/posts/images/photo.jpg');

      // Set up assets so the asset can be found
      allAssets.set([mockAsset]);

      const result = getAssetByAbsolutePath({
        path: '/posts/images/photo.jpg',
        entry: undefined,
        collectionName: 'posts',
        fileName: undefined,
      });

      expect(result).toEqual(mockAsset);
      expect(getAssetFolder).toHaveBeenCalledWith({
        collectionName: 'posts',
        fileName: undefined,
      });
    });

    it('should return undefined when no asset found', async () => {
      const { stripSlashes } = await import('@sveltia/utils/string');
      const { getPathInfo } = await import('@sveltia/utils/file');
      const { getAssetFolder } = await import('$lib/services/assets/folders');

      vi.mocked(stripSlashes).mockReturnValue('/nonexistent/photo.jpg');
      allAssets.set([]);
      vi.mocked(getPathInfo).mockReturnValue({
        dirname: '/nonexistent',
        basename: 'photo.jpg',
        filename: 'photo',
        extension: '.jpg',
      });
      vi.mocked(getAssetFolder).mockReturnValue(undefined);

      const result = getAssetByAbsolutePath({
        path: '/nonexistent/photo.jpg',
        entry: undefined,
        collectionName: 'posts',
        fileName: undefined,
      });

      expect(result).toBeUndefined();
    });
  });
});
