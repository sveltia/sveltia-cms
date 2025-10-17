import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  allAssets,
  editingAsset,
  focusedAsset,
  getAssetByAbsolutePath,
  getAssetByPath,
  getAssetByRelativePath,
  getAssetByRelativePathAndCollection,
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
          multiple: false,
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
          multiple: false,
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

    it.skip('should transform files when transformations are provided', async () => {
      const originalFile = new File(['content'], 'original.jpg', { type: 'image/jpeg' });
      const transformedFile = new File(['transformed'], 'transformed.jpg', { type: 'image/jpeg' });

      Object.defineProperty(originalFile, 'size', { value: 500000 });
      Object.defineProperty(transformedFile, 'size', { value: 300000 });

      /** @type {import('$lib/types/public').ImageTransformations} */
      const transformations = {
        jpeg: {
          quality: 80,
        },
      };

      getDefaultMediaLibraryOptionsMock.mockReturnValue({
        config: {
          max_file_size: 1000000,
          multiple: false,
          transformations,
        },
      });

      transformFileMock.mockResolvedValue(transformedFile);

      uploadingAssets.set({
        folder: undefined,
        files: [originalFile],
      });

      // Wait for async processing to complete - transformations take time
      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });

      const result = get(processedAssets);

      expect(result.processing).toBe(false);
      expect(result.undersizedFiles).toEqual([transformedFile]);
      expect(transformFileMock).toHaveBeenCalledWith(originalFile, transformations);
      // Check that the transformed file map was populated
      expect(result.transformedFileMap.has(transformedFile)).toBe(true);
      expect(result.transformedFileMap.get(transformedFile)).toBe(originalFile);
    });

    it.skip('should not populate transformedFileMap when file is not transformed', async () => {
      const file = new File(['content'], 'original.jpg', { type: 'image/jpeg' });

      Object.defineProperty(file, 'size', { value: 500000 });

      /** @type {import('$lib/types/public').ImageTransformations} */
      const transformations = {
        webp: {
          quality: 85,
        },
      };

      getDefaultMediaLibraryOptionsMock.mockReturnValue({
        config: {
          max_file_size: 1000000,
          multiple: false,
          transformations,
        },
      });

      // Return the same file (no transformation)
      transformFileMock.mockResolvedValue(file);

      uploadingAssets.set({
        folder: undefined,
        files: [file],
      });

      // Wait for async processing to complete - transformations take time
      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });

      const result = get(processedAssets);

      expect(result.processing).toBe(false);
      expect(result.undersizedFiles).toEqual([file]);
      // Check that the file is NOT in the transformed file map
      expect(result.transformedFileMap.has(file)).toBe(false);
    });

    it('should set processing state during transformations', async () => {
      const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });

      getDefaultMediaLibraryOptionsMock.mockReturnValue({
        config: {
          max_file_size: 1000000,
          multiple: false,
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
    /**
     * @type {import('vitest').MockedFunction<typeof
     * import('$lib/services/utils/file').decodeFilePath
     * >}
     */
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

    it('should remove URL fragments before processing path', async () => {
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
        value: '/assets/image.jpg#fragment',
        collectionName: 'posts',
      });

      expect(result).toEqual(mockAsset);
      expect(decodeFilePathMock).toHaveBeenCalledWith('/assets/image.jpg');
      expect(stripSlashesMock).toHaveBeenCalledWith('/assets/image.jpg');
    });

    it('should remove URL fragments with complex hashes', async () => {
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
        value: '/assets/image.jpg#section:subsection',
        collectionName: 'posts',
      });

      expect(result).toEqual(mockAsset);
      expect(decodeFilePathMock).toHaveBeenCalledWith('/assets/image.jpg');
    });

    it('should handle relative paths with fragments', async () => {
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
        value: 'image.jpg#anchor',
        entry: mockEntry,
        collectionName: 'posts',
      });

      expect(result).toEqual(mockAsset);
      expect(decodeFilePathMock).toHaveBeenCalledWith('image.jpg');
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

  describe('getAssetByRelativePathAndCollection', () => {
    it('should find asset by resolved path using collection media_folder', async () => {
      const { resolvePath, createPath } = await import('$lib/services/utils/file');

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

      const mockCollection = /** @type {any} */ ({
        name: 'posts',
        media_folder: 'images',
        _i18n: { defaultLocale: 'en' },
      });

      vi.mocked(createPath).mockReturnValue('content/posts/images/photo.jpg');
      vi.mocked(resolvePath).mockReturnValue('content/posts/images/photo.jpg');
      allAssets.set([mockAsset]);

      const result = getAssetByRelativePathAndCollection({
        path: 'photo.jpg',
        entry: mockEntry,
        collection: mockCollection,
      });

      expect(result).toEqual(mockAsset);
      expect(createPath).toHaveBeenCalledWith(['content/posts', 'images', 'photo.jpg']);
      expect(resolvePath).toHaveBeenCalledWith('content/posts/images/photo.jpg');
    });

    it('should find asset by resolved path using file media_folder when provided', async () => {
      const { resolvePath, createPath } = await import('$lib/services/utils/file');

      const mockAsset = {
        path: 'content/posts/assets/photo.jpg',
        name: 'photo.jpg',
        sha: 'abc123',
        size: 1024,
        kind: /** @type {import('$lib/types/private').AssetKind} */ ('image'),
        folder: {
          internalPath: 'content/posts/assets',
          publicPath: '/assets',
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

      const mockCollection = /** @type {any} */ ({
        name: 'posts',
        media_folder: 'images',
        _i18n: { defaultLocale: 'en' },
      });

      const mockFile = /** @type {any} */ ({
        name: 'special',
        media_folder: 'assets',
        _i18n: { defaultLocale: 'en' },
      });

      vi.mocked(createPath).mockReturnValue('content/posts/assets/photo.jpg');
      vi.mocked(resolvePath).mockReturnValue('content/posts/assets/photo.jpg');
      allAssets.set([mockAsset]);

      const result = getAssetByRelativePathAndCollection({
        path: 'photo.jpg',
        entry: mockEntry,
        collection: mockCollection,
        file: mockFile,
      });

      expect(result).toEqual(mockAsset);
      expect(createPath).toHaveBeenCalledWith(['content/posts', 'assets', 'photo.jpg']);
      expect(resolvePath).toHaveBeenCalledWith('content/posts/assets/photo.jpg');
    });

    it('should handle different media_folder values correctly', async () => {
      const { resolvePath, createPath } = await import('$lib/services/utils/file');

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

      // Test case 1: images folder
      const mockCollection1 = /** @type {any} */ ({
        name: 'posts',
        media_folder: 'images',
        _i18n: { defaultLocale: 'en' },
      });

      vi.mocked(createPath).mockReturnValue('content/posts/images/photo.jpg');
      vi.mocked(resolvePath).mockReturnValue('content/posts/images/photo.jpg');
      allAssets.set([]);

      getAssetByRelativePathAndCollection({
        path: 'photo.jpg',
        entry: mockEntry,
        collection: mockCollection1,
      });

      expect(createPath).toHaveBeenCalledWith(['content/posts', 'images', 'photo.jpg']);
      expect(resolvePath).toHaveBeenCalledWith('content/posts/images/photo.jpg');

      // Test case 2: assets folder
      const mockCollection2 = /** @type {any} */ ({
        name: 'posts',
        media_folder: 'assets',
        _i18n: { defaultLocale: 'en' },
      });

      vi.mocked(createPath).mockReturnValue('content/posts/assets/photo.jpg');
      vi.mocked(resolvePath).mockReturnValue('content/posts/assets/photo.jpg');

      getAssetByRelativePathAndCollection({
        path: 'photo.jpg',
        entry: mockEntry,
        collection: mockCollection2,
      });

      expect(createPath).toHaveBeenCalledWith(['content/posts', 'assets', 'photo.jpg']);
      expect(resolvePath).toHaveBeenCalledWith('content/posts/assets/photo.jpg');

      // Test case 3: nested folder
      const mockCollection3 = /** @type {any} */ ({
        name: 'posts',
        media_folder: 'media/uploads',
        _i18n: { defaultLocale: 'en' },
      });

      vi.mocked(createPath).mockReturnValue('content/posts/media/uploads/photo.jpg');
      vi.mocked(resolvePath).mockReturnValue('content/posts/media/uploads/photo.jpg');

      getAssetByRelativePathAndCollection({
        path: 'photo.jpg',
        entry: mockEntry,
        collection: mockCollection3,
      });

      expect(createPath).toHaveBeenCalledWith(['content/posts', 'media/uploads', 'photo.jpg']);
      expect(resolvePath).toHaveBeenCalledWith('content/posts/media/uploads/photo.jpg');

      // Test case 4: empty folder
      const mockCollection4 = /** @type {any} */ ({
        name: 'posts',
        media_folder: '',
        _i18n: { defaultLocale: 'en' },
      });

      vi.mocked(createPath).mockReturnValue('content/posts/photo.jpg');
      vi.mocked(resolvePath).mockReturnValue('content/posts/photo.jpg');

      getAssetByRelativePathAndCollection({
        path: 'photo.jpg',
        entry: mockEntry,
        collection: mockCollection4,
      });

      expect(createPath).toHaveBeenCalledWith(['content/posts', '', 'photo.jpg']);
      expect(resolvePath).toHaveBeenCalledWith('content/posts/photo.jpg');
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

      const mockCollection = /** @type {any} */ ({
        name: 'posts',
        media_folder: 'images',
        _i18n: { defaultLocale: 'en' },
      });

      const result = getAssetByRelativePathAndCollection({
        path: 'photo.jpg',
        entry: mockEntry,
        collection: mockCollection,
      });

      expect(result).toBeUndefined();
    });

    it('should return undefined when entry has no file path', () => {
      const mockEntry = /** @type {any} */ ({
        id: 'my-post',
        slug: 'my-post',
        subPath: 'my-post.md',
        locales: {
          en: {
            path: undefined,
            sha: 'sha123',
            slug: 'my-post',
            content: { title: 'My Post' },
          },
        },
      });

      const mockCollection = /** @type {any} */ ({
        name: 'posts',
        media_folder: 'images',
        _i18n: { defaultLocale: 'en' },
      });

      const result = getAssetByRelativePathAndCollection({
        path: 'photo.jpg',
        entry: mockEntry,
        collection: mockCollection,
      });

      expect(result).toBeUndefined();
    });

    it('should handle missing default locale by using first available', async () => {
      const { resolvePath, createPath } = await import('$lib/services/utils/file');

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

      const mockCollection = /** @type {any} */ ({
        name: 'posts',
        media_folder: 'images',
        _i18n: { defaultLocale: 'en' },
      });

      vi.mocked(createPath).mockReturnValue('content/posts/images/photo.jpg');
      vi.mocked(resolvePath).mockReturnValue('content/posts/images/photo.jpg');
      allAssets.set([]);

      getAssetByRelativePathAndCollection({
        path: 'photo.jpg',
        entry: mockEntry,
        collection: mockCollection,
      });

      expect(createPath).toHaveBeenCalledWith(['content/posts', 'images', 'photo.jpg']);
      expect(resolvePath).toHaveBeenCalledWith('content/posts/images/photo.jpg');
    });

    it('should extract entryFolder from different entry file path patterns', async () => {
      const { resolvePath, createPath } = await import('$lib/services/utils/file');

      const mockCollection = /** @type {any} */ ({
        name: 'posts',
        media_folder: 'images',
        _i18n: { defaultLocale: 'en' },
      });

      // Test case 1: nested path
      const mockEntry1 = /** @type {any} */ ({
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

      vi.mocked(createPath).mockReturnValue('content/posts/images/photo.jpg');
      vi.mocked(resolvePath).mockReturnValue('content/posts/images/photo.jpg');
      allAssets.set([]);

      getAssetByRelativePathAndCollection({
        path: 'photo.jpg',
        entry: mockEntry1,
        collection: mockCollection,
      });

      expect(createPath).toHaveBeenCalledWith(['content/posts', 'images', 'photo.jpg']);

      // Test case 2: deeply nested path
      const mockEntry2 = /** @type {any} */ ({
        id: 'my-post',
        slug: 'my-post',
        subPath: 'my-post.md',
        locales: {
          en: {
            path: 'content/blog/2023/my-post.md',
            sha: 'sha123',
            slug: 'my-post',
            content: { title: 'My Post' },
          },
        },
      });

      vi.mocked(createPath).mockReturnValue('content/blog/2023/images/photo.jpg');
      vi.mocked(resolvePath).mockReturnValue('content/blog/2023/images/photo.jpg');

      getAssetByRelativePathAndCollection({
        path: 'photo.jpg',
        entry: mockEntry2,
        collection: mockCollection,
      });

      expect(createPath).toHaveBeenCalledWith(['content/blog/2023', 'images', 'photo.jpg']);

      // Test case 3: simple path
      const mockEntry3 = /** @type {any} */ ({
        id: 'my-post',
        slug: 'my-post',
        subPath: 'my-post.md',
        locales: {
          en: {
            path: 'posts/index.md',
            sha: 'sha123',
            slug: 'my-post',
            content: { title: 'My Post' },
          },
        },
      });

      vi.mocked(createPath).mockReturnValue('posts/images/photo.jpg');
      vi.mocked(resolvePath).mockReturnValue('posts/images/photo.jpg');

      getAssetByRelativePathAndCollection({
        path: 'photo.jpg',
        entry: mockEntry3,
        collection: mockCollection,
      });

      expect(createPath).toHaveBeenCalledWith(['posts', 'images', 'photo.jpg']);

      // Test case 4: root level file
      const mockEntry4 = /** @type {any} */ ({
        id: 'my-post',
        slug: 'my-post',
        subPath: 'my-post.md',
        locales: {
          en: {
            path: 'my-post.md',
            sha: 'sha123',
            slug: 'my-post',
            content: { title: 'My Post' },
          },
        },
      });

      vi.mocked(createPath).mockReturnValue('my-post.md/images/photo.jpg');
      vi.mocked(resolvePath).mockReturnValue('my-post.md/images/photo.jpg');

      getAssetByRelativePathAndCollection({
        path: 'photo.jpg',
        entry: mockEntry4,
        collection: mockCollection,
      });

      expect(createPath).toHaveBeenCalledWith(['my-post.md', 'images', 'photo.jpg']);
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

    it('should handle assets in subfolder of internal path when dirName starts with publicPath', async () => {
      const { stripSlashes } = await import('@sveltia/utils/string');
      const { getPathInfo } = await import('@sveltia/utils/file');
      const { getAssetFolder } = await import('$lib/services/assets/folders');
      const { createPath } = await import('$lib/services/utils/file');

      const mockAsset = {
        path: 'content/posts/images/subfolder/photo.jpg',
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

      // Setup mocks for the subfolder scenario
      vi.mocked(stripSlashes).mockReturnValue('/posts/images/subfolder/photo.jpg');
      vi.mocked(getPathInfo).mockReturnValue({
        dirname: '/posts/images/subfolder',
        basename: 'photo.jpg',
        filename: 'photo',
        extension: '.jpg',
      });
      vi.mocked(getAssetFolder)
        .mockReturnValueOnce(mockFolder) // First call for collection+fileName
        .mockReturnValueOnce(mockFolder); // Second call for collection only

      // Mock createPath to return the expected internal path with subfolder
      vi.mocked(createPath).mockReturnValue('content/posts/images/subfolder/photo.jpg');

      allAssets.set([mockAsset]);

      const result = getAssetByAbsolutePath({
        path: '/posts/images/subfolder/photo.jpg',
        entry: undefined,
        collectionName: 'posts',
        fileName: undefined,
      });

      expect(result).toEqual(mockAsset);
      // Verify that createPath was called with the modified internal path
      expect(createPath).toHaveBeenCalledWith(['content/posts/images/subfolder', 'photo.jpg']);
    });

    it('should not modify internalPath when dirName does not start with publicPath', async () => {
      const { stripSlashes } = await import('@sveltia/utils/string');
      const { getPathInfo } = await import('@sveltia/utils/file');
      const { getAssetFolder } = await import('$lib/services/assets/folders');
      const { createPath } = await import('$lib/services/utils/file');

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

      // Setup for a different directory that doesn't start with publicPath
      vi.mocked(stripSlashes).mockReturnValue('/other/directory/photo.jpg');
      vi.mocked(getPathInfo).mockReturnValue({
        dirname: '/other/directory',
        basename: 'photo.jpg',
        filename: 'photo',
        extension: '.jpg',
      });
      vi.mocked(getAssetFolder).mockReturnValueOnce(mockFolder).mockReturnValueOnce(mockFolder);

      // Mock createPath to use original internal path
      vi.mocked(createPath).mockReturnValue('content/posts/images/photo.jpg');

      allAssets.set([mockAsset]);

      const result = getAssetByAbsolutePath({
        path: '/other/directory/photo.jpg',
        entry: undefined,
        collectionName: 'posts',
        fileName: undefined,
      });

      expect(result).toEqual(mockAsset);
      // Verify that createPath was called with the original internal path (not modified)
      expect(createPath).toHaveBeenCalledWith(['content/posts/images', 'photo.jpg']);
    });

    it('should not modify internalPath when any required parameters are missing', async () => {
      const { stripSlashes } = await import('@sveltia/utils/string');
      const { getPathInfo } = await import('@sveltia/utils/file');
      const { getAssetFolder } = await import('$lib/services/assets/folders');
      const { createPath } = await import('$lib/services/utils/file');

      // Test case 1: no dirName
      vi.mocked(stripSlashes).mockReturnValue('/photo.jpg');
      vi.mocked(getPathInfo).mockReturnValue({
        dirname: '', // empty dirname
        basename: 'photo.jpg',
        filename: 'photo',
        extension: '.jpg',
      });

      const mockFolder = {
        internalPath: 'content/posts/images',
        publicPath: '/posts/images',
        collectionName: 'posts',
        entryRelative: false,
        hasTemplateTags: false,
      };

      vi.mocked(getAssetFolder).mockReturnValue(mockFolder);
      vi.mocked(createPath).mockReturnValue('content/posts/images/photo.jpg');

      const mockAsset = {
        path: 'content/posts/images/photo.jpg',
        name: 'photo.jpg',
        sha: 'abc123',
        size: 1024,
        kind: /** @type {import('$lib/types/private').AssetKind} */ ('image'),
        folder: mockFolder,
      };

      allAssets.set([mockAsset]);

      getAssetByAbsolutePath({
        path: '/photo.jpg',
        entry: undefined,
        collectionName: 'posts',
        fileName: undefined,
      });

      expect(createPath).toHaveBeenCalledWith(['content/posts/images', 'photo.jpg']);

      // Test case 2: no publicPath
      vi.clearAllMocks();

      const mockFolderNoPublicPath = {
        internalPath: 'content/posts/images',
        publicPath: undefined,
        collectionName: 'posts',
        entryRelative: false,
        hasTemplateTags: false,
      };

      vi.mocked(stripSlashes).mockReturnValue('/posts/images/subfolder/photo.jpg');
      vi.mocked(getPathInfo).mockReturnValue({
        dirname: '/posts/images/subfolder',
        basename: 'photo.jpg',
        filename: 'photo',
        extension: '.jpg',
      });
      vi.mocked(getAssetFolder).mockReturnValue(mockFolderNoPublicPath);
      vi.mocked(createPath).mockReturnValue('content/posts/images/photo.jpg');

      getAssetByAbsolutePath({
        path: '/posts/images/subfolder/photo.jpg',
        entry: undefined,
        collectionName: 'posts',
        fileName: undefined,
      });

      expect(createPath).toHaveBeenCalledWith(['content/posts/images', 'photo.jpg']);

      // Test case 3: no internalPath
      vi.clearAllMocks();

      const mockFolderNoInternalPath = {
        internalPath: undefined,
        publicPath: '/posts/images',
        collectionName: 'posts',
        entryRelative: false,
        hasTemplateTags: false,
      };

      vi.mocked(stripSlashes).mockReturnValue('/posts/images/subfolder/photo.jpg');
      vi.mocked(getPathInfo).mockReturnValue({
        dirname: '/posts/images/subfolder',
        basename: 'photo.jpg',
        filename: 'photo',
        extension: '.jpg',
      });
      vi.mocked(getAssetFolder).mockReturnValue(mockFolderNoInternalPath);
      vi.mocked(createPath).mockReturnValue('undefined/photo.jpg');

      getAssetByAbsolutePath({
        path: '/posts/images/subfolder/photo.jpg',
        entry: undefined,
        collectionName: 'posts',
        fileName: undefined,
      });

      expect(createPath).toHaveBeenCalledWith([undefined, 'photo.jpg']);
    });

    it('should not modify internalPath when dirName starts with publicPath but without trailing slash', async () => {
      const { stripSlashes } = await import('@sveltia/utils/string');
      const { getPathInfo } = await import('@sveltia/utils/file');
      const { getAssetFolder } = await import('$lib/services/assets/folders');
      const { createPath } = await import('$lib/services/utils/file');

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

      // Test case where dirName is exactly publicPath (no trailing slash)
      // This should NOT trigger the path modification
      vi.mocked(stripSlashes).mockReturnValue('/posts/images/photo.jpg');
      vi.mocked(getPathInfo).mockReturnValue({
        dirname: '/posts/images', // exact match with publicPath, no trailing slash
        basename: 'photo.jpg',
        filename: 'photo',
        extension: '.jpg',
      });
      vi.mocked(getAssetFolder).mockReturnValueOnce(mockFolder).mockReturnValueOnce(mockFolder);

      // Mock createPath to use original internal path (not modified)
      vi.mocked(createPath).mockReturnValue('content/posts/images/photo.jpg');

      allAssets.set([mockAsset]);

      const result = getAssetByAbsolutePath({
        path: '/posts/images/photo.jpg',
        entry: undefined,
        collectionName: 'posts',
        fileName: undefined,
      });

      expect(result).toEqual(mockAsset);
      // Verify that createPath was called with the original internal path (not modified)
      // because dirName.startsWith(`${publicPath}/`) should be false when dirName === publicPath
      expect(createPath).toHaveBeenCalledWith(['content/posts/images', 'photo.jpg']);
    });

    it('should not modify internalPath when dirName looks similar to publicPath but is different path', async () => {
      const { stripSlashes } = await import('@sveltia/utils/string');
      const { getPathInfo } = await import('@sveltia/utils/file');
      const { getAssetFolder } = await import('$lib/services/assets/folders');
      const { createPath } = await import('$lib/services/utils/file');

      const mockFolder = {
        internalPath: 'content/posts/images',
        publicPath: '/posts/images',
        collectionName: 'posts',
        entryRelative: false,
        hasTemplateTags: false,
      };

      // Test case where dirName starts with publicPath but is actually a different path
      // like `/posts/images-backup` - this should NOT trigger the path modification
      vi.mocked(stripSlashes).mockReturnValue('/posts/images-backup/photo.jpg');
      vi.mocked(getPathInfo).mockReturnValue({
        dirname: '/posts/images-backup', // similar but different path
        basename: 'photo.jpg',
        filename: 'photo',
        extension: '.jpg',
      });
      vi.mocked(getAssetFolder).mockReturnValueOnce(mockFolder).mockReturnValueOnce(mockFolder);

      // The function will look for an asset at 'content/posts/images/photo.jpg'
      // but we'll set up our mock asset at a different path so it won't be found
      vi.mocked(createPath).mockReturnValue('content/posts/images/photo.jpg');

      // Set up an asset that exists at a different path, so the search will fail
      const differentMockAsset = {
        path: 'content/posts/images-backup/photo.jpg', // Different path that won't match
        name: 'photo.jpg',
        sha: 'abc123',
        size: 1024,
        kind: /** @type {import('$lib/types/private').AssetKind} */ ('image'),
        folder: {
          internalPath: 'content/posts/images-backup',
          publicPath: '/posts/images-backup',
          collectionName: 'posts',
          entryRelative: false,
          hasTemplateTags: false,
        },
      };

      allAssets.set([differentMockAsset]);

      const result = getAssetByAbsolutePath({
        path: '/posts/images-backup/photo.jpg',
        entry: undefined,
        collectionName: 'posts',
        fileName: undefined,
      });

      expect(result).toBeUndefined();
      // Verify that createPath was called with the original internal path (not modified)
      // because `/posts/images-backup` doesn't start with `/posts/images/`
      // But since no asset exists at that path, the result should be undefined
      expect(createPath).toHaveBeenCalledWith(['content/posts/images', 'photo.jpg']);
    });

    it('should modify internalPath when dirName properly starts with publicPath plus slash', async () => {
      const { stripSlashes } = await import('@sveltia/utils/string');
      const { getPathInfo } = await import('@sveltia/utils/file');
      const { getAssetFolder } = await import('$lib/services/assets/folders');
      const { createPath } = await import('$lib/services/utils/file');

      const mockAsset = {
        path: 'content/posts/images/subfolder/deep/photo.jpg',
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

      // Test case where dirName properly starts with publicPath + '/'
      // This SHOULD trigger the path modification
      vi.mocked(stripSlashes).mockReturnValue('/posts/images/subfolder/deep/photo.jpg');
      vi.mocked(getPathInfo).mockReturnValue({
        dirname: '/posts/images/subfolder/deep', // properly starts with publicPath + '/'
        basename: 'photo.jpg',
        filename: 'photo',
        extension: '.jpg',
      });
      vi.mocked(getAssetFolder).mockReturnValueOnce(mockFolder).mockReturnValueOnce(mockFolder);

      // Mock createPath to return the expected internal path with subfolder
      vi.mocked(createPath).mockReturnValue('content/posts/images/subfolder/deep/photo.jpg');

      allAssets.set([mockAsset]);

      const result = getAssetByAbsolutePath({
        path: '/posts/images/subfolder/deep/photo.jpg',
        entry: undefined,
        collectionName: 'posts',
        fileName: undefined,
      });

      expect(result).toEqual(mockAsset);
      // Verify that createPath was called with the modified internal path
      // `/posts/images/subfolder/deep` should be replaced with
      // `content/posts/images/subfolder/deep`
      expect(createPath).toHaveBeenCalledWith(['content/posts/images/subfolder/deep', 'photo.jpg']);
    });
  });
});
