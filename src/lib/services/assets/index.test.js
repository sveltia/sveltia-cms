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
  isRelativePath,
  overlaidAsset,
  processedAssets,
  renamingAsset,
  selectedAssets,
  uploadingAssets,
} from '.';

// Mock all dependencies
vi.mock('@sveltia/utils/file');
vi.mock('@sveltia/utils/string');
vi.mock('fast-deep-equal');
vi.mock('flat');
vi.mock('$lib/services/integrations/media-libraries/default');
vi.mock('$lib/services/common/slug');
vi.mock('$lib/services/common/template');
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
      const { getDefaultMediaLibraryOptions, transformFile } =
        await import('$lib/services/integrations/media-libraries/default');

      getDefaultMediaLibraryOptionsMock = vi.mocked(getDefaultMediaLibraryOptions);
      transformFileMock = vi.mocked(transformFile);

      getDefaultMediaLibraryOptionsMock.mockReturnValue({
        enabled: true,
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
        enabled: true,
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

    it('should transform files when transformations are provided', async () => {
      const originalFile = new File(['content'], 'original.jpg', { type: 'image/jpeg' });
      const transformedFile = new File(['transformed'], 'transformed.jpg', { type: 'image/jpeg' });

      Object.defineProperty(originalFile, 'size', { value: 500000 });
      Object.defineProperty(transformedFile, 'size', { value: 300000 });

      const transformations = /** @type {import('$lib/types/public').ImageTransformations} */ ({
        webp: { width: 800 },
      });

      getDefaultMediaLibraryOptionsMock.mockReturnValue({
        enabled: true,
        config: {
          max_file_size: 1000000,
          multiple: false,
          transformations,
        },
      });

      let latestState = /** @type {any} */ (null);

      // Subscribe persistently so async updates are captured
      const unsubscribe = processedAssets.subscribe((state) => {
        latestState = state;
      });

      transformFileMock.mockResolvedValue(transformedFile);

      uploadingAssets.set({
        folder: undefined,
        files: [originalFile],
      });

      // Wait for the async IIFE, Promise.all, and store updates to settle
      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });

      unsubscribe();

      expect(latestState.processing).toBe(false);
      expect(transformFileMock).toHaveBeenCalledWith(originalFile, transformations);
      expect(latestState.undersizedFiles).toEqual([transformedFile]);
    });

    it('should populate transformedFileMap when file is transformed', async () => {
      const originalFile = new File(['content'], 'original.jpg', { type: 'image/jpeg' });
      const transformedFile = new File(['transformed'], 'transformed.jpg', { type: 'image/jpeg' });

      Object.defineProperty(originalFile, 'size', { value: 500000 });
      Object.defineProperty(transformedFile, 'size', { value: 300000 });

      getDefaultMediaLibraryOptionsMock.mockReturnValue({
        enabled: true,
        config: {
          max_file_size: 1000000,
          multiple: false,
          transformations: /** @type {import('$lib/types/public').ImageTransformations} */ ({
            webp: { width: 800 },
          }),
        },
      });

      let latestState = /** @type {any} */ (null);

      const unsubscribe = processedAssets.subscribe((state) => {
        latestState = state;
      });

      // Return a different file instance (transformed)
      transformFileMock.mockResolvedValue(transformedFile);

      uploadingAssets.set({
        folder: undefined,
        files: [originalFile],
      });

      // Wait for async processing to complete
      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });

      unsubscribe();

      // The transformedFileMap should map transformedFile -> originalFile
      expect(latestState.transformedFileMap.get(transformedFile)).toBe(originalFile);
    });

    it('should not populate transformedFileMap when file is not transformed', async () => {
      const originalFile = new File(['content'], 'original.jpg', { type: 'image/jpeg' });

      Object.defineProperty(originalFile, 'size', { value: 500000 });

      getDefaultMediaLibraryOptionsMock.mockReturnValue({
        enabled: true,
        config: {
          max_file_size: 1000000,
          multiple: false,
          transformations: /** @type {import('$lib/types/public').ImageTransformations} */ ({
            webp: { width: 800 },
          }),
        },
      });

      let latestState = /** @type {any} */ (null);

      const unsubscribe = processedAssets.subscribe((state) => {
        latestState = state;
      });

      // Return the same file instance (no actual transformation)
      transformFileMock.mockResolvedValue(originalFile);

      uploadingAssets.set({
        folder: undefined,
        files: [originalFile],
      });

      // Wait for async processing to complete
      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });

      unsubscribe();

      // transformedFileMap should not have the original file mapped (file not transformed)
      expect(latestState.transformedFileMap.get(originalFile)).toBeUndefined();
    });

    it('should set processing state during transformations', async () => {
      const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });

      getDefaultMediaLibraryOptionsMock.mockReturnValue({
        enabled: true,
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

    it('should handle empty files array with transformations undefined', async () => {
      getDefaultMediaLibraryOptionsMock.mockReturnValue({
        enabled: true,
        config: {
          max_file_size: 1000000,
          multiple: false,
          transformations: undefined,
        },
      });

      uploadingAssets.set({
        folder: undefined,
        files: [],
      });

      // Wait for async processing
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });

      const result = get(processedAssets);

      expect(result.processing).toBe(false);
      expect(result.undersizedFiles).toEqual([]);
      expect(result.oversizedFiles).toEqual([]);
    });

    it('should handle mixed file sizes across boundary', async () => {
      const file1 = new File(['x'], 'file1.txt', { type: 'text/plain' });
      const file2 = new File(['x'], 'file2.txt', { type: 'text/plain' });
      const file3 = new File(['x'], 'file3.txt', { type: 'text/plain' });

      // Set sizes at boundary and beyond
      Object.defineProperty(file1, 'size', { value: 1000000 }); // Exactly at max size
      Object.defineProperty(file2, 'size', { value: 1000001 }); // Just over max size
      Object.defineProperty(file3, 'size', { value: 999999 }); // Just under max size

      uploadingAssets.set({
        folder: undefined,
        files: [file1, file2, file3],
      });

      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });

      const result = get(processedAssets);

      expect(result.undersizedFiles).toEqual([file1, file3]);
      expect(result.oversizedFiles).toEqual([file2]);
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

    it('should strip media_folder prefix from path when stored value includes it', async () => {
      // Regression: when the stored value already includes the media_folder prefix (e.g. "images"),
      // it was previously passed verbatim, resulting in the duplicated path
      // "entryFolder/images/images/photo.jpg" instead of "entryFolder/images/photo.jpg".
      const { resolvePath, createPath } = await import('$lib/services/utils/file');

      const mockAsset = {
        path: 'content/test1/my-slug/images/photo.jpg',
        name: 'photo.jpg',
        sha: 'abc123',
        size: 1024,
        kind: /** @type {import('$lib/types/private').AssetKind} */ ('image'),
        folder: {
          internalPath: 'content/test1/my-slug/images',
          publicPath: 'images',
          collectionName: 'test1',
          entryRelative: true,
          hasTemplateTags: false,
        },
      };

      // Entry file lives at content/test1/my-slug/index.md (path template: {{slug}}/index)
      const mockEntry = /** @type {any} */ ({
        id: 'my-slug',
        slug: 'my-slug',
        locales: {
          en: {
            path: 'content/test1/my-slug/index.md',
            sha: 'sha123',
            slug: 'my-slug',
            content: { title: 'My Title' },
          },
        },
      });

      // Collection mirrors the YAML sample: media_folder is "images"
      const mockCollection = /** @type {any} */ ({
        name: 'test1',
        media_folder: 'images',
        _i18n: { defaultLocale: 'en' },
      });

      // The stored field value includes the media_folder prefix: "images/photo.jpg"
      const storedPath = 'images/photo.jpg';

      vi.mocked(createPath).mockReturnValue('content/test1/my-slug/images/photo.jpg');
      vi.mocked(resolvePath).mockReturnValue('content/test1/my-slug/images/photo.jpg');
      allAssets.set([mockAsset]);

      const result = getAssetByRelativePathAndCollection({
        path: storedPath,
        entry: mockEntry,
        collection: mockCollection,
      });

      expect(result).toEqual(mockAsset);
      // Prefix must be stripped: createPath should receive bare "photo.jpg", not "images/photo.jpg"
      expect(createPath).toHaveBeenCalledWith(['content/test1/my-slug', 'images', 'photo.jpg']);
      expect(resolvePath).toHaveBeenCalledWith('content/test1/my-slug/images/photo.jpg');
    });

    it('should strip media_folder prefix when path contains a sub-folder', async () => {
      // Variant: stored value is "images/sub/photo.jpg" with media_folder "images"
      const { resolvePath, createPath } = await import('$lib/services/utils/file');

      const mockAsset = {
        path: 'content/test1/my-slug/images/sub/photo.jpg',
        name: 'photo.jpg',
        sha: 'abc123',
        size: 1024,
        kind: /** @type {import('$lib/types/private').AssetKind} */ ('image'),
        folder: {
          internalPath: 'content/test1/my-slug/images',
          publicPath: 'images',
          collectionName: 'test1',
          entryRelative: true,
          hasTemplateTags: false,
        },
      };

      const mockEntry = /** @type {any} */ ({
        id: 'my-slug',
        slug: 'my-slug',
        locales: {
          en: {
            path: 'content/test1/my-slug/index.md',
            sha: 'sha123',
            slug: 'my-slug',
            content: { title: 'My Title' },
          },
        },
      });

      const mockCollection = /** @type {any} */ ({
        name: 'test1',
        media_folder: 'images',
        _i18n: { defaultLocale: 'en' },
      });

      vi.mocked(createPath).mockReturnValue('content/test1/my-slug/images/sub/photo.jpg');
      vi.mocked(resolvePath).mockReturnValue('content/test1/my-slug/images/sub/photo.jpg');
      allAssets.set([mockAsset]);

      const result = getAssetByRelativePathAndCollection({
        path: 'images/sub/photo.jpg',
        entry: mockEntry,
        collection: mockCollection,
      });

      expect(result).toEqual(mockAsset);
      expect(createPath).toHaveBeenCalledWith(['content/test1/my-slug', 'images', 'sub/photo.jpg']);
    });

    it('should normalize ./ prefix in stored path before stripping media_folder prefix', async () => {
      // When public_folder is `./images`, the stored value is `./images/photo.jpg`. The leading
      // `./` must be stripped so the `images/` media_folder prefix is correctly detected and
      // removed, avoiding the duplicated path `entryFolder/images/./images/photo.jpg`.
      const { resolvePath, createPath } = await import('$lib/services/utils/file');

      const mockAsset = {
        path: 'src/content/entries/images/photo.jpg',
        name: 'photo.jpg',
        sha: 'abc123',
        size: 1024,
        kind: /** @type {import('$lib/types/private').AssetKind} */ ('image'),
        folder: {
          internalPath: 'src/content/entries',
          internalSubPath: 'images',
          publicPath: './images',
          collectionName: 'entries',
          entryRelative: true,
          hasTemplateTags: false,
        },
      };

      const mockEntry = /** @type {any} */ ({
        id: 'my-entry',
        slug: 'my-entry',
        locales: {
          en: {
            path: 'src/content/entries/my-entry.md',
            sha: 'sha123',
            slug: 'my-entry',
            content: { title: 'My Entry' },
          },
        },
      });

      const mockCollection = /** @type {any} */ ({
        name: 'entries',
        media_folder: 'images',
        _i18n: { defaultLocale: 'en' },
      });

      vi.mocked(createPath).mockReturnValue('src/content/entries/images/photo.jpg');
      vi.mocked(resolvePath).mockReturnValue('src/content/entries/images/photo.jpg');
      allAssets.set([mockAsset]);

      const result = getAssetByRelativePathAndCollection({
        path: './images/photo.jpg',
        entry: mockEntry,
        collection: mockCollection,
      });

      expect(result).toEqual(mockAsset);
      // `./images/photo.jpg` → normalized to `images/photo.jpg` → prefix `images/` stripped
      expect(createPath).toHaveBeenCalledWith(['src/content/entries', 'images', 'photo.jpg']);
    });

    it('should not strip path prefix when media_folder is undefined', async () => {
      // When collection has no media_folder, the path must be passed through unchanged
      const { resolvePath, createPath } = await import('$lib/services/utils/file');

      const mockEntry = /** @type {any} */ ({
        id: 'my-post',
        slug: 'my-post',
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
        media_folder: undefined,
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

      expect(createPath).toHaveBeenCalledWith(['content/posts', undefined, 'photo.jpg']);
    });

    it('should not strip path prefix when path does not start with media_folder', async () => {
      // Guard against over-stripping: "other/photo.jpg" with media_folder "images" is untouched
      const { resolvePath, createPath } = await import('$lib/services/utils/file');

      const mockEntry = /** @type {any} */ ({
        id: 'my-post',
        slug: 'my-post',
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

      vi.mocked(createPath).mockReturnValue('content/posts/images/other/photo.jpg');
      vi.mocked(resolvePath).mockReturnValue('content/posts/images/other/photo.jpg');
      allAssets.set([]);

      getAssetByRelativePathAndCollection({
        path: 'other/photo.jpg',
        entry: mockEntry,
        collection: mockCollection,
      });

      // "other/photo.jpg" doesn't start with "images/", so it is passed as-is
      expect(createPath).toHaveBeenCalledWith(['content/posts', 'images', 'other/photo.jpg']);
    });

    it('should use field-level internalSubPath when typedKeyPath matches an entry-relative folder', async () => {
      const { resolvePath, createPath } = await import('$lib/services/utils/file');
      const { getAssetFolder } = await import('$lib/services/assets/folders');

      const mockAsset = {
        path: 'content/posts/my-slug/images1/photo.jpg',
        name: 'photo.jpg',
        sha: 'abc123',
        size: 1024,
        kind: /** @type {import('$lib/types/private').AssetKind} */ ('image'),
        folder: {
          internalPath: 'content/posts/my-slug/images1',
          internalSubPath: 'images1',
          publicPath: 'images1',
          collectionName: 'posts',
          entryRelative: true,
          hasTemplateTags: false,
          typedKeyPath: 'hero',
        },
      };

      const mockEntry = /** @type {any} */ ({
        id: 'my-slug',
        slug: 'my-slug',
        locales: {
          en: {
            path: 'content/posts/my-slug/index.md',
            sha: 'sha123',
            slug: 'my-slug',
            content: { title: 'My Title' },
          },
        },
      });

      // Collection-level media_folder is an absolute path that would resolve incorrectly
      // without the typedKeyPath lookup
      const mockCollection = /** @type {any} */ ({
        name: 'posts',
        media_folder: '/src/assets/images/blog',
        _i18n: { defaultLocale: 'en' },
      });

      const mockFieldFolder = /** @type {any} */ ({
        internalPath: 'content/posts/my-slug/images1',
        internalSubPath: 'images1',
        publicPath: 'images1',
        collectionName: 'posts',
        entryRelative: true,
        hasTemplateTags: false,
        typedKeyPath: 'hero',
      });

      vi.mocked(getAssetFolder).mockReturnValue(mockFieldFolder);
      vi.mocked(createPath).mockReturnValue('content/posts/my-slug/images1/photo.jpg');
      vi.mocked(resolvePath).mockReturnValue('content/posts/my-slug/images1/photo.jpg');
      allAssets.set([mockAsset]);

      const result = getAssetByRelativePathAndCollection({
        path: 'photo.jpg',
        entry: mockEntry,
        collection: mockCollection,
        typedKeyPath: 'hero',
      });

      expect(result).toEqual(mockAsset);
      expect(getAssetFolder).toHaveBeenCalledWith({
        collectionName: 'posts',
        fileName: undefined,
        typedKeyPath: 'hero',
      });
      // Must use 'images1' from internalSubPath, not the collection's absolute media_folder
      expect(createPath).toHaveBeenCalledWith(['content/posts/my-slug', 'images1', 'photo.jpg']);
    });

    it('should fall back to collection media_folder when typed key path folder is not entry-relative', async () => {
      const { resolvePath, createPath } = await import('$lib/services/utils/file');
      const { getAssetFolder } = await import('$lib/services/assets/folders');

      const mockEntry = /** @type {any} */ ({
        id: 'my-post',
        slug: 'my-post',
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

      // Field folder is NOT entry-relative (global/absolute folder)
      const mockFieldFolder = /** @type {any} */ ({
        internalPath: 'src/assets/images',
        publicPath: '/images',
        collectionName: 'posts',
        entryRelative: false,
        hasTemplateTags: false,
        typedKeyPath: 'hero',
      });

      vi.mocked(getAssetFolder).mockReturnValue(mockFieldFolder);
      vi.mocked(createPath).mockReturnValue('content/posts/images/photo.jpg');
      vi.mocked(resolvePath).mockReturnValue('content/posts/images/photo.jpg');
      allAssets.set([]);

      getAssetByRelativePathAndCollection({
        path: 'photo.jpg',
        entry: mockEntry,
        collection: mockCollection,
        typedKeyPath: 'hero',
      });

      // When field folder is not entry-relative, use collection's media_folder
      expect(createPath).toHaveBeenCalledWith(['content/posts', 'images', 'photo.jpg']);
    });

    it('should use empty string when typedKeyPath folder is entry-relative but has no internalSubPath', async () => {
      const { resolvePath, createPath } = await import('$lib/services/utils/file');
      const { getAssetFolder } = await import('$lib/services/assets/folders');

      const mockEntry = /** @type {any} */ ({
        id: 'my-post',
        slug: 'my-post',
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

      // Field folder is entry-relative but has no internalSubPath — hits the `?? ''` fallback
      const mockFieldFolder = /** @type {any} */ ({
        internalPath: 'content/posts/my-post',
        internalSubPath: undefined,
        publicPath: '',
        collectionName: 'posts',
        entryRelative: true,
        hasTemplateTags: false,
        typedKeyPath: 'hero',
      });

      vi.mocked(getAssetFolder).mockReturnValue(mockFieldFolder);
      vi.mocked(createPath).mockReturnValue('content/posts/photo.jpg');
      vi.mocked(resolvePath).mockReturnValue('content/posts/photo.jpg');
      allAssets.set([]);

      getAssetByRelativePathAndCollection({
        path: 'photo.jpg',
        entry: mockEntry,
        collection: mockCollection,
        typedKeyPath: 'hero',
      });

      // internalSubPath is undefined → mediaFolder falls back to '' (empty string)
      expect(createPath).toHaveBeenCalledWith(['content/posts', '', 'photo.jpg']);
    });
  });

  describe('getAssetByRelativePath', () => {
    it('should return undefined when no entry and no collectionName provided', () => {
      const result = getAssetByRelativePath({
        path: 'images/photo.jpg',
        entry: undefined,
      });

      expect(result).toBeUndefined();
    });

    it('should find asset in a non-entry-relative collection folder when no entry provided', async () => {
      const { getAssetFolder } = await import('$lib/services/assets/folders');
      const { createPath } = await import('$lib/services/utils/file');

      const mockAsset = {
        path: 'uploads/photo.jpg',
        name: 'photo.jpg',
        sha: 'abc123',
        size: 1024,
        kind: /** @type {import('$lib/types/private').AssetKind} */ ('image'),
        folder: {
          internalPath: 'uploads',
          publicPath: '/uploads',
          collectionName: 'posts',
          entryRelative: false,
          hasTemplateTags: false,
        },
      };

      const mockFolder = {
        internalPath: 'uploads',
        publicPath: '/uploads',
        collectionName: 'posts',
        entryRelative: false,
        hasTemplateTags: false,
      };

      vi.mocked(getAssetFolder).mockReturnValue(mockFolder);
      vi.mocked(createPath).mockReturnValue('uploads/photo.jpg');
      allAssets.set([mockAsset]);

      const result = getAssetByRelativePath({
        path: 'photo.jpg',
        entry: undefined,
        collectionName: 'posts',
      });

      expect(result).toEqual(mockAsset);
      expect(getAssetFolder).toHaveBeenCalledWith({ collectionName: 'posts', fileName: undefined });
    });

    it('should query getAssetFolder with typedKeyPath when both collectionName and typedKeyPath are provided with no entry', async () => {
      const { getAssetFolder } = await import('$lib/services/assets/folders');
      const { createPath } = await import('$lib/services/utils/file');

      const mockAsset = {
        path: 'uploads/hero.jpg',
        name: 'hero.jpg',
        sha: 'abc123',
        size: 1024,
        kind: /** @type {import('$lib/types/private').AssetKind} */ ('image'),
        folder: {
          internalPath: 'uploads',
          publicPath: '/uploads',
          collectionName: 'posts',
          entryRelative: false,
          hasTemplateTags: false,
          typedKeyPath: 'hero',
        },
      };

      const mockFolder = {
        internalPath: 'uploads',
        publicPath: '/uploads',
        collectionName: 'posts',
        entryRelative: false,
        hasTemplateTags: false,
        typedKeyPath: 'hero',
      };

      vi.mocked(getAssetFolder).mockReturnValue(mockFolder);
      vi.mocked(createPath).mockReturnValue('uploads/hero.jpg');
      allAssets.set([mockAsset]);

      const result = getAssetByRelativePath({
        path: 'hero.jpg',
        entry: undefined,
        collectionName: 'posts',
        typedKeyPath: 'hero',
      });

      expect(result).toEqual(mockAsset);
      expect(getAssetFolder).toHaveBeenCalledWith({
        collectionName: 'posts',
        fileName: undefined,
        typedKeyPath: 'hero',
      });
    });

    it('should query getAssetFolder with typedKeyPath when both collectionName and typedKeyPath are provided with no entry', async () => {
      const { getAssetFolder } = await import('$lib/services/assets/folders');
      const { createPath } = await import('$lib/services/utils/file');

      const mockAsset = {
        path: 'uploads/photo.jpg',
        name: 'photo.jpg',
        sha: 'abc123',
        size: 1024,
        kind: /** @type {import('$lib/types/private').AssetKind} */ ('image'),
        folder: {
          internalPath: 'uploads',
          publicPath: '/uploads',
          collectionName: 'posts',
          entryRelative: false,
          hasTemplateTags: false,
        },
      };

      const mockFolder = {
        internalPath: 'uploads',
        publicPath: '/uploads',
        collectionName: 'posts',
        entryRelative: false,
        hasTemplateTags: false,
      };

      vi.mocked(getAssetFolder).mockReturnValue(mockFolder);
      vi.mocked(createPath).mockReturnValue('uploads/photo.jpg');
      allAssets.set([mockAsset]);

      // path with publicPath prefix already included (e.g. public_folder: "uploads")
      const result = getAssetByRelativePath({
        path: 'uploads/photo.jpg',
        entry: undefined,
        collectionName: 'posts',
      });

      expect(result).toEqual(mockAsset);
      // createPath should be called with the prefix stripped: internalSubPath is '' for
      // non-entry-relative
      expect(createPath).toHaveBeenCalledWith(['uploads', '', 'photo.jpg']);
    });

    it('should find asset in an entry-relative folder using internalPath+internalSubPath when no entry provided', async () => {
      const { getAssetFolder, globalAssetFolder } = await import('$lib/services/assets/folders');
      const { createPath } = await import('$lib/services/utils/file');

      const mockAsset = {
        path: 'content/posts/images/photo.jpg',
        name: 'photo.jpg',
        sha: 'abc123',
        size: 1024,
        kind: /** @type {import('$lib/types/private').AssetKind} */ ('image'),
        folder: {
          internalPath: 'content/posts',
          internalSubPath: 'images',
          publicPath: 'images',
          collectionName: 'posts',
          entryRelative: true,
          hasTemplateTags: false,
        },
      };

      const entryRelativeFolder = {
        internalPath: 'content/posts',
        internalSubPath: 'images',
        publicPath: 'images',
        collectionName: 'posts',
        entryRelative: true,
        hasTemplateTags: false,
      };

      vi.mocked(getAssetFolder).mockReturnValue(entryRelativeFolder);
      vi.mocked(createPath).mockReturnValue('content/posts/images/photo.jpg');
      /** @type {import('svelte/store').Writable<any>} */ (globalAssetFolder).set(undefined);
      allAssets.set([mockAsset]);

      const result = getAssetByRelativePath({
        path: 'photo.jpg',
        entry: undefined,
        collectionName: 'posts',
      });

      // Entry-relative folders are now scanned using internalPath + internalSubPath
      expect(result).toEqual(mockAsset);
      expect(createPath).toHaveBeenCalledWith(['content/posts', 'images', 'photo.jpg']);

      /** @type {import('svelte/store').Writable<any>} */ (globalAssetFolder).set({});
    });

    it('should skip template-tag folders when no entry provided', async () => {
      const { getAssetFolder, globalAssetFolder } = await import('$lib/services/assets/folders');
      const { createPath } = await import('$lib/services/utils/file');

      const templateTagFolder = {
        internalPath: 'content/{{slug}}/images',
        publicPath: 'images',
        collectionName: 'posts',
        entryRelative: false,
        hasTemplateTags: true,
      };

      vi.mocked(getAssetFolder).mockReturnValue(templateTagFolder);
      /** @type {import('svelte/store').Writable<any>} */ (globalAssetFolder).set(undefined);
      allAssets.set([]);

      const result = getAssetByRelativePath({
        path: 'photo.jpg',
        entry: undefined,
        collectionName: 'posts',
      });

      // Template-tag folders cannot be resolved without an entry → skipped
      expect(result).toBeUndefined();
      expect(createPath).not.toHaveBeenCalled();

      /** @type {import('svelte/store').Writable<any>} */ (globalAssetFolder).set({});
    });

    it('should fall back to exact path match when no entry and folder scan fails', async () => {
      const { getAssetFolder } = await import('$lib/services/assets/folders');

      const mockAsset = {
        path: 'static/photo.jpg',
        name: 'photo.jpg',
        sha: 'abc123',
        size: 1024,
        kind: /** @type {import('$lib/types/private').AssetKind} */ ('image'),
        folder: {
          internalPath: 'static',
          publicPath: '/',
          collectionName: undefined,
          entryRelative: false,
          hasTemplateTags: false,
        },
      };

      vi.mocked(getAssetFolder).mockReturnValue(undefined);
      allAssets.set([mockAsset]);

      // If the asset's own path is stored as the value (exact match), it should be found
      const result = getAssetByRelativePath({
        path: 'static/photo.jpg',
        entry: undefined,
        collectionName: 'posts',
      });

      expect(result).toEqual(mockAsset);
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
          omitDefaultLocaleFromFilePath: false,
          omitDefaultLocaleFromPreviewPath: false,
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
          omitDefaultLocaleFromFilePath: false,
          omitDefaultLocaleFromPreviewPath: false,
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

    it('should use collection files when collectionFiles.length > 0 (line 174)', async () => {
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

      const mockCollectionFile = /** @type {any} */ ({
        name: 'posts',
        media_folder: 'images',
        _i18n: {
          defaultLocale: 'en',
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
          omitDefaultLocaleFromFilePath: false,
          omitDefaultLocaleFromPreviewPath: false,
          structureMap: {},
        },
        media_folder: 'images',
      });

      vi.mocked(getAssociatedCollections).mockReturnValue([mockCollection]);
      // THIS returns a non-empty array to trigger the if branch at line 174
      vi.mocked(getCollectionFilesByEntry).mockReturnValue([mockCollectionFile]);

      allAssets.set([]);

      getAssetByRelativePath({
        path: 'photo.jpg',
        entry: mockEntry,
      });

      // Verify that getCollectionFilesByEntry was called and returned a non-empty array
      // This confirms we entered the if (collectionFiles.length) branch at line 174
      expect(getCollectionFilesByEntry).toHaveBeenCalledWith(mockCollection, mockEntry);
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

    it('should skip template resolution when entry is missing but template exists', async () => {
      const { stripSlashes } = await import('@sveltia/utils/string');
      const { getPathInfo } = await import('@sveltia/utils/file');
      const { getAssetFolder } = await import('$lib/services/assets/folders');

      const mockFolderWithTemplate = {
        internalPath: 'content/posts/{{slug}}/media',
        publicPath: '/media',
        collectionName: 'posts',
        entryRelative: false,
        hasTemplateTags: true,
      };

      vi.mocked(stripSlashes).mockReturnValue('/media/photo.jpg');
      vi.mocked(getPathInfo).mockReturnValue({
        dirname: '/media',
        basename: 'photo.jpg',
        filename: 'photo',
        extension: '.jpg',
      });

      vi.mocked(getAssetFolder)
        .mockReturnValueOnce(mockFolderWithTemplate)
        .mockReturnValueOnce(mockFolderWithTemplate);

      allAssets.set([]);

      const result = getAssetByAbsolutePath({
        path: '/media/photo.jpg',
        entry: undefined,
        collectionName: 'posts',
        fileName: undefined,
      });

      expect(result).toBeUndefined();
    });

    it('should resolve template tags in internalPath when entry and collection exist (lines 213-237)', async () => {
      const { stripSlashes } = await import('@sveltia/utils/string');
      const { getPathInfo } = await import('@sveltia/utils/file');
      const { getAssetFolder, globalAssetFolder } = await import('$lib/services/assets/folders');
      const { getAssociatedCollections } = await import('$lib/services/contents/entry');
      const { fillTemplate } = await import('$lib/services/common/template');
      const { flatten } = await import('flat');
      const { createPath } = await import('$lib/services/utils/file');

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
        },
      });

      const mockFolderWithTemplate = {
        internalPath: 'content/posts/{{slug}}/media',
        publicPath: '/media',
        collectionName: undefined, // No collectionName so it uses getAssociatedCollections
        entryRelative: false,
        hasTemplateTags: true,
      };

      const mockAsset = {
        path: 'content/posts/my-post/media/photo.jpg',
        name: 'photo.jpg',
        sha: 'abc123',
        size: 1024,
        kind: /** @type {import('$lib/types/private').AssetKind} */ ('image'),
        folder: mockFolderWithTemplate,
      };

      vi.mocked(stripSlashes).mockReturnValue('/media/photo.jpg');
      vi.mocked(getPathInfo).mockReturnValue({
        dirname: '/media',
        basename: 'photo.jpg',
        filename: 'photo',
        extension: '.jpg',
      });

      // Return the template folder as the first getAssetFolder result
      vi.mocked(getAssetFolder).mockReturnValue(mockFolderWithTemplate);

      // Make globalAssetFolder falsy so it's filtered out
      /** @type {import('svelte/store').Writable<any>} */ (globalAssetFolder).set(undefined);

      // Setup mocks for template resolution
      vi.mocked(getAssociatedCollections).mockReturnValue([mockCollection]);
      vi.mocked(fillTemplate).mockReturnValue('content/posts/my-post/media');
      vi.mocked(flatten).mockReturnValue({ slug: 'my-post' });
      vi.mocked(createPath).mockReturnValue('content/posts/my-post/media/photo.jpg');

      allAssets.set([mockAsset]);

      const result = getAssetByAbsolutePath({
        path: '/media/photo.jpg',
        entry: mockEntry,
        collectionName: 'posts',
        fileName: undefined,
      });

      // Restore globalAssetFolder to its default
      /** @type {import('svelte/store').Writable<any>} */ (globalAssetFolder).set({});

      expect(result).toEqual(mockAsset);
      expect(fillTemplate).toHaveBeenCalledWith(
        'content/posts/{{slug}}/media',
        expect.objectContaining({ type: 'media_folder', collection: mockCollection }),
      );
    });

    it('should return false for template resolution when collection cannot be found (line 213)', async () => {
      const { stripSlashes } = await import('@sveltia/utils/string');
      const { getPathInfo } = await import('@sveltia/utils/file');
      const { getAssetFolder, allAssetFolders } = await import('$lib/services/assets/folders');
      const { getAssociatedCollections } = await import('$lib/services/contents/entry');

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

      const mockFolderWithTemplate = {
        internalPath: 'content/{{slug}}/media',
        publicPath: '/media',
        collectionName: undefined,
        entryRelative: false,
        hasTemplateTags: true,
      };

      vi.mocked(stripSlashes).mockReturnValue('/media/photo.jpg');
      vi.mocked(getPathInfo).mockReturnValue({
        dirname: '/media',
        basename: 'photo.jpg',
        filename: 'photo',
        extension: '.jpg',
      });

      vi.mocked(getAssetFolder)
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(undefined);

      allAssetFolders.set([mockFolderWithTemplate]);
      vi.mocked(getAssociatedCollections).mockReturnValue([]);

      allAssets.set([]);

      const result = getAssetByAbsolutePath({
        path: '/media/photo.jpg',
        entry: mockEntry,
        collectionName: '',
        fileName: undefined,
      });

      expect(result).toBeUndefined();
    });

    it('should append dirName to internalPath when publicPath is root "/"', async () => {
      const { stripSlashes } = await import('@sveltia/utils/string');
      const { getPathInfo } = await import('@sveltia/utils/file');
      const { getAssetFolder } = await import('$lib/services/assets/folders');
      const { createPath } = await import('$lib/services/utils/file');

      const mockAsset = {
        path: 'assets/subfolder/photo.jpg',
        name: 'photo.jpg',
        sha: 'abc123',
        size: 1024,
        kind: /** @type {import('$lib/types/private').AssetKind} */ ('image'),
        folder: {
          internalPath: 'assets',
          publicPath: '/',
          collectionName: undefined,
          entryRelative: false,
          hasTemplateTags: false,
        },
      };

      const mockFolder = {
        internalPath: 'assets',
        publicPath: '/',
        collectionName: undefined,
        entryRelative: false,
        hasTemplateTags: false,
      };

      // When publicPath is '/', dirName like '/subfolder' should be appended
      // to internalPath as 'assets/subfolder' (not '/subfolder' + 'assets')
      vi.mocked(stripSlashes).mockReturnValue('/subfolder/photo.jpg');
      vi.mocked(getPathInfo).mockReturnValue({
        dirname: '/subfolder',
        basename: 'photo.jpg',
        filename: 'photo',
        extension: '.jpg',
      });
      vi.mocked(getAssetFolder).mockReturnValueOnce(mockFolder).mockReturnValueOnce(mockFolder);

      // Mock createPath to return the expected internal path with appended dirName
      // The logic should compute: internalPath + dirName = 'assets' + '/subfolder' =
      // 'assets/subfolder'
      vi.mocked(createPath).mockReturnValue('assets/subfolder/photo.jpg');

      allAssets.set([mockAsset]);

      const result = getAssetByAbsolutePath({
        path: '/subfolder/photo.jpg',
        entry: undefined,
        collectionName: '',
        fileName: undefined,
      });

      expect(result).toEqual(mockAsset);
      // Verify that createPath was called with internalPath appended with dirName
      // 'assets' + '/subfolder' should produce 'assets/subfolder'
      expect(createPath).toHaveBeenCalledWith(['assets/subfolder', 'photo.jpg']);
    });

    it('should handle nested paths with non-root publicPath', async () => {
      const { stripSlashes } = await import('@sveltia/utils/string');
      const { getPathInfo } = await import('@sveltia/utils/file');
      const { getAssetFolder } = await import('$lib/services/assets/folders');
      const { createPath } = await import('$lib/services/utils/file');

      // Asset stored at: content/posts/media/album/2024/photo.jpg
      // With internalPath: content/posts/media
      // Accessed via publicPath: /media/album/2024
      const mockAsset = {
        path: 'content/posts/media/album/2024/photo.jpg',
        name: 'photo.jpg',
        sha: 'abc123',
        size: 1024,
        kind: /** @type {import('$lib/types/private').AssetKind} */ ('image'),
        folder: {
          internalPath: 'content/posts/media',
          publicPath: '/media',
          collectionName: 'posts',
          entryRelative: false,
          hasTemplateTags: false,
        },
      };

      const mockFolder = {
        internalPath: 'content/posts/media',
        publicPath: '/media',
        collectionName: 'posts',
        entryRelative: false,
        hasTemplateTags: false,
      };

      // Request path includes nested folders: /media/album/2024/photo.jpg
      vi.mocked(stripSlashes).mockReturnValue('/media/album/2024/photo.jpg');
      vi.mocked(getPathInfo).mockReturnValue({
        dirname: '/media/album/2024',
        basename: 'photo.jpg',
        filename: 'photo',
        extension: '.jpg',
      });
      vi.mocked(getAssetFolder).mockReturnValue(mockFolder);

      // When replacing /media in /media/album/2024 with content/posts/media
      // Result should be content/posts/media/album/2024
      vi.mocked(createPath).mockReturnValueOnce('content/posts/media/album/2024/photo.jpg');

      allAssets.set([mockAsset]);

      const result = getAssetByAbsolutePath({
        path: '/media/album/2024/photo.jpg',
        entry: undefined,
        collectionName: 'posts',
        fileName: undefined,
      });

      expect(result).toEqual(mockAsset);
    });

    it('should handle deeply nested paths with root publicPath', async () => {
      const { stripSlashes } = await import('@sveltia/utils/string');
      const { getPathInfo } = await import('@sveltia/utils/file');
      const { getAssetFolder } = await import('$lib/services/assets/folders');
      const { createPath } = await import('$lib/services/utils/file');

      // Asset stored at: static/images/gallery/albums/2024/march/photo.jpg
      // With internalPath: static
      // Accessed via publicPath: root /
      const mockAsset = {
        path: 'static/images/gallery/albums/2024/march/photo.jpg',
        name: 'photo.jpg',
        sha: 'abc123',
        size: 1024,
        kind: /** @type {import('$lib/types/private').AssetKind} */ ('image'),
        folder: {
          internalPath: 'static',
          publicPath: '/',
          collectionName: undefined,
          entryRelative: false,
          hasTemplateTags: false,
        },
      };

      const mockFolder = {
        internalPath: 'static',
        publicPath: '/',
        collectionName: undefined,
        entryRelative: false,
        hasTemplateTags: false,
      };

      // Request path with deeply nested structure
      vi.mocked(stripSlashes).mockReturnValue('/images/gallery/albums/2024/march/photo.jpg');
      vi.mocked(getPathInfo).mockReturnValue({
        dirname: '/images/gallery/albums/2024/march',
        basename: 'photo.jpg',
        filename: 'photo',
        extension: '.jpg',
      });
      vi.mocked(getAssetFolder).mockReturnValue(mockFolder);

      // When publicPath is /, concat: static + /images/gallery/albums/2024/march
      vi.mocked(createPath).mockReturnValueOnce(
        'static/images/gallery/albums/2024/march/photo.jpg',
      );

      allAssets.set([mockAsset]);

      const result = getAssetByAbsolutePath({
        path: '/images/gallery/albums/2024/march/photo.jpg',
        entry: undefined,
        collectionName: '',
        fileName: undefined,
      });

      expect(result).toEqual(mockAsset);
    });

    it('should call getAssetFolder with typedKeyPath as first scanning folder when provided', async () => {
      const { stripSlashes } = await import('@sveltia/utils/string');
      const { getPathInfo } = await import('@sveltia/utils/file');
      const { getAssetFolder } = await import('$lib/services/assets/folders');
      const { createPath } = await import('$lib/services/utils/file');

      const mockAsset = {
        path: 'content/posts/my-slug/images1/photo.jpg',
        name: 'photo.jpg',
        sha: 'abc123',
        size: 1024,
        kind: /** @type {import('$lib/types/private').AssetKind} */ ('image'),
        folder: {
          internalPath: 'content/posts/my-slug/images1',
          publicPath: '/images1',
          collectionName: 'posts',
          entryRelative: true,
          hasTemplateTags: false,
        },
      };

      const mockFieldFolder = {
        internalPath: 'content/posts/my-slug/images1',
        internalSubPath: 'images1',
        publicPath: '/images1',
        collectionName: 'posts',
        entryRelative: true,
        hasTemplateTags: false,
        typedKeyPath: 'hero',
      };

      vi.mocked(stripSlashes).mockReturnValue('/images1/photo.jpg');
      vi.mocked(getPathInfo).mockReturnValue({
        dirname: '/images1',
        basename: 'photo.jpg',
        filename: 'photo',
        extension: '.jpg',
      });
      vi.mocked(getAssetFolder)
        .mockReturnValueOnce(mockFieldFolder) // call 1: with typedKeyPath
        .mockReturnValueOnce(undefined) // call 2: without typedKeyPath, with fileName
        .mockReturnValueOnce(undefined); // call 3: without typedKeyPath, without fileName
      vi.mocked(createPath).mockReturnValue('content/posts/my-slug/images1/photo.jpg');
      allAssets.set([mockAsset]);

      const result = getAssetByAbsolutePath({
        path: '/images1/photo.jpg',
        entry: undefined,
        collectionName: 'posts',
        fileName: undefined,
        typedKeyPath: 'hero',
      });

      expect(result).toEqual(mockAsset);
      expect(getAssetFolder).toHaveBeenNthCalledWith(1, {
        collectionName: 'posts',
        fileName: undefined,
        typedKeyPath: 'hero',
      });
    });
  });

  describe('additional edge cases and scenarios', () => {
    it('should handle getAssetsByFolder with multiple matching folders', async () => {
      const { default: equal } = await import('fast-deep-equal');
      const equalMock = vi.mocked(equal);

      const folder1 = {
        internalPath: 'assets/images',
        publicPath: '/assets/images',
        collectionName: undefined,
        entryRelative: false,
        hasTemplateTags: false,
      };

      const folder2 = {
        internalPath: 'assets/documents',
        publicPath: '/assets/documents',
        collectionName: undefined,
        entryRelative: false,
        hasTemplateTags: false,
      };

      const asset1 = {
        path: 'assets/images/photo.jpg',
        name: 'photo.jpg',
        kind: /** @type {import('$lib/types/private').AssetKind} */ ('image'),
        sha: 'abc123',
        size: 1024,
        folder: folder1,
      };

      const asset2 = {
        path: 'assets/documents/report.pdf',
        name: 'report.pdf',
        kind: /** @type {import('$lib/types/private').AssetKind} */ ('document'),
        sha: 'def456',
        size: 2048,
        folder: folder2,
      };

      const asset3 = {
        path: 'assets/images/icon.png',
        name: 'icon.png',
        kind: /** @type {import('$lib/types/private').AssetKind} */ ('image'),
        sha: 'ghi789',
        size: 512,
        folder: folder1,
      };

      allAssets.set([asset1, asset2, asset3]);

      // Mock equal to match folder1 only
      equalMock.mockImplementation((a, b) => {
        if (a === folder1 && b === folder1) return true;
        if (a === folder2 && b === folder2) return true;
        return false;
      });

      const result = getAssetsByFolder(folder1);

      expect(result).toEqual([asset1, asset3]);
      expect(result.length).toBe(2);
    });

    it('should handle getAssetsByDirName with nested directories', async () => {
      const { getPathInfo } = await import('@sveltia/utils/file');
      const getPathInfoMock = vi.mocked(getPathInfo);

      const asset1 = {
        path: 'assets/nested/deep/folder/image.jpg',
        name: 'image.jpg',
        kind: /** @type {import('$lib/types/private').AssetKind} */ ('image'),
        sha: 'abc123',
        size: 1024,
        folder: {
          internalPath: 'assets/nested/deep/folder',
          publicPath: '/assets/nested/deep/folder',
          collectionName: undefined,
          entryRelative: false,
          hasTemplateTags: false,
        },
      };

      const asset2 = {
        path: 'assets/nested/deep/image2.jpg',
        name: 'image2.jpg',
        kind: /** @type {import('$lib/types/private').AssetKind} */ ('image'),
        sha: 'def456',
        size: 2048,
        folder: {
          internalPath: 'assets/nested/deep',
          publicPath: '/assets/nested/deep',
          collectionName: undefined,
          entryRelative: false,
          hasTemplateTags: false,
        },
      };

      allAssets.set([asset1, asset2]);

      getPathInfoMock.mockImplementation((/** @type {string} */ path) => {
        if (path === 'assets/nested/deep/folder/image.jpg') {
          return {
            dirname: 'assets/nested/deep/folder',
            basename: 'image.jpg',
            filename: 'image',
            extension: '.jpg',
          };
        }

        if (path === 'assets/nested/deep/image2.jpg') {
          return {
            dirname: 'assets/nested/deep',
            basename: 'image2.jpg',
            filename: 'image2',
            extension: '.jpg',
          };
        }

        return { dirname: '', basename: '', filename: '', extension: '' };
      });

      const result = getAssetsByDirName('assets/nested/deep/folder');

      expect(result).toEqual([asset1]);
    });

    it('should handle getAssetByRelativePathAndCollection with complex entry paths', async () => {
      const { resolvePath, createPath } = await import('$lib/services/utils/file');

      const mockAsset = {
        path: 'content/blog/2024/01/post/media/banner.jpg',
        name: 'banner.jpg',
        sha: 'abc123',
        size: 1024,
        kind: /** @type {import('$lib/types/private').AssetKind} */ ('image'),
        folder: {
          internalPath: 'content/blog/2024/01/post/media',
          publicPath: '/media',
          collectionName: 'blog',
          entryRelative: false,
          hasTemplateTags: false,
        },
      };

      const mockEntry = /** @type {any} */ ({
        id: 'jan-post',
        slug: 'january-post',
        subPath: 'january-post.md',
        locales: {
          en: {
            path: 'content/blog/2024/01/post/january-post.md',
            sha: 'sha123',
            slug: 'january-post',
            content: { title: 'January Post', date: '2024-01-01' },
          },
        },
      });

      const mockCollection = /** @type {any} */ ({
        name: 'blog',
        media_folder: 'media',
        _i18n: { defaultLocale: 'en' },
      });

      vi.mocked(createPath).mockReturnValue('content/blog/2024/01/post/media/banner.jpg');
      vi.mocked(resolvePath).mockReturnValue('content/blog/2024/01/post/media/banner.jpg');
      allAssets.set([mockAsset]);

      const result = getAssetByRelativePathAndCollection({
        path: 'banner.jpg',
        entry: mockEntry,
        collection: mockCollection,
      });

      expect(result).toEqual(mockAsset);
      expect(createPath).toHaveBeenCalledWith(['content/blog/2024/01/post', 'media', 'banner.jpg']);
    });

    it('should handle getAssetByPath with complex relative paths', async () => {
      const { resolvePath } = await import('$lib/services/utils/file');
      const { getAssociatedCollections } = await import('$lib/services/contents/entry');
      const { getCollectionFilesByEntry } = await import('$lib/services/contents/collection/files');
      const resolvePathMock = vi.mocked(resolvePath);
      const getAssociatedCollectionsMock = vi.mocked(getAssociatedCollections);
      const getCollectionFilesByEntryMock = vi.mocked(getCollectionFilesByEntry);

      const mockEntry = /** @type {any} */ ({
        slug: 'complex-entry',
        id: 'complex-entry',
        subPath: 'index.md',
        locales: {
          en: {
            path: 'content/posts/2024/complex-entry/index.md',
            content: { title: 'Complex Entry' },
          },
        },
      });

      const mockCollection = /** @type {any} */ ({
        name: 'posts',
        _i18n: { defaultLocale: 'en' },
      });

      const mockAsset = {
        path: 'content/posts/2024/complex-entry/images/nested/deep.jpg',
        name: 'deep.jpg',
        kind: /** @type {import('$lib/types/private').AssetKind} */ ('image'),
        sha: 'abc123',
        size: 1024,
        folder: {
          internalPath: 'content/posts/2024/complex-entry/images',
          publicPath: '/posts/images',
          collectionName: 'posts',
          entryRelative: false,
          hasTemplateTags: false,
        },
      };

      allAssets.set([mockAsset]);
      resolvePathMock.mockReturnValue('content/posts/2024/complex-entry/images/nested/deep.jpg');
      getAssociatedCollectionsMock.mockReturnValue([mockCollection]);
      getCollectionFilesByEntryMock.mockReturnValue([]);

      const result = getAssetByPath({
        value: 'images/nested/deep.jpg',
        entry: mockEntry,
        collectionName: 'posts',
      });

      expect(result).toEqual(mockAsset);
    });

    it('should categorize boundary case file sizes correctly', async () => {
      const smallFile1 = new File(['x'], 'small1.txt', { type: 'text/plain' });
      const smallFile2 = new File(['x'], 'small2.txt', { type: 'text/plain' });
      const largeFile1 = new File(['x'], 'large1.txt', { type: 'text/plain' });
      const largeFile2 = new File(['x'], 'large2.txt', { type: 'text/plain' });

      // Set various boundary conditions
      Object.defineProperty(smallFile1, 'size', { value: 1 }); // Very small
      Object.defineProperty(smallFile2, 'size', { value: 999999 }); // Just under max
      Object.defineProperty(largeFile1, 'size', { value: 1000001 }); // Just over max
      Object.defineProperty(largeFile2, 'size', { value: 10000000 }); // Very large

      const { getDefaultMediaLibraryOptions } =
        await import('$lib/services/integrations/media-libraries/default');

      vi.mocked(getDefaultMediaLibraryOptions).mockReturnValue({
        enabled: true,
        config: {
          max_file_size: 1000000,
          multiple: false,
          transformations: undefined,
        },
      });

      uploadingAssets.set({
        folder: undefined,
        files: [smallFile1, smallFile2, largeFile1, largeFile2],
      });

      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });

      const result = get(processedAssets);

      expect(result.undersizedFiles).toEqual([smallFile1, smallFile2]);
      expect(result.oversizedFiles).toEqual([largeFile1, largeFile2]);
      expect(result.undersizedFiles.length).toBe(2);
      expect(result.oversizedFiles.length).toBe(2);
    });

    it('should handle getAssetByAbsolutePath with global asset folder fallback', async () => {
      const { stripSlashes } = await import('@sveltia/utils/string');
      const { getPathInfo } = await import('@sveltia/utils/file');
      const { getAssetFolder } = await import('$lib/services/assets/folders');
      const { createPath } = await import('$lib/services/utils/file');

      const mockAsset = {
        path: 'assets/global/photo.jpg',
        name: 'photo.jpg',
        sha: 'abc123',
        size: 1024,
        kind: /** @type {import('$lib/types/private').AssetKind} */ ('image'),
        folder: {
          internalPath: 'assets/global',
          publicPath: '/assets',
          collectionName: undefined,
          entryRelative: false,
          hasTemplateTags: false,
        },
      };

      vi.mocked(stripSlashes).mockReturnValue('/assets/photo.jpg');
      vi.mocked(getPathInfo).mockReturnValue({
        dirname: '/assets',
        basename: 'photo.jpg',
        filename: 'photo',
        extension: '.jpg',
      });

      vi.mocked(getAssetFolder).mockReturnValue(undefined); // Collection folders not found
      vi.mocked(createPath).mockReturnValue('assets/global/photo.jpg');

      allAssets.set([mockAsset]);

      const result = getAssetByAbsolutePath({
        path: '/assets/photo.jpg',
        entry: undefined,
        collectionName: 'posts',
        fileName: undefined,
      });

      // Asset should be found even without global folder being set
      expect(result).toBeDefined();
    });

    it('should return undefined for getAssetByRelativePath with no matching collections', async () => {
      const { getAssociatedCollections } = await import('$lib/services/contents/entry');
      const { getCollectionFilesByEntry } = await import('$lib/services/contents/collection/files');

      const mockEntry = /** @type {any} */ ({
        id: 'test-entry',
        slug: 'test-entry',
        subPath: 'test-entry.md',
        locales: {
          en: {
            path: 'content/test-entry.md',
            content: { title: 'Test Entry' },
          },
        },
      });

      vi.mocked(getAssociatedCollections).mockReturnValue([]);
      vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
      allAssets.set([]);

      const result = getAssetByRelativePath({
        path: 'image.jpg',
        entry: mockEntry,
      });

      expect(result).toBeUndefined();
    });

    it('should handle getAssetByPath with @ symbol prefix correctly', async () => {
      const { stripSlashes } = await import('@sveltia/utils/string');
      const stripSlashesMock = vi.mocked(stripSlashes);

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

      stripSlashesMock.mockReturnValue('@assets/image.jpg');
      allAssets.set([mockAsset]);

      const result = getAssetByPath({
        value: '@assets/image.jpg',
        collectionName: 'posts',
      });

      expect(result).toEqual(mockAsset);
      expect(stripSlashesMock).toHaveBeenCalled();
    });

    it('should properly distinguish between absolute and relative paths in getAssetByPath', async () => {
      const { resolvePath } = await import('$lib/services/utils/file');
      const { getAssociatedCollections } = await import('$lib/services/contents/entry');
      const { getCollectionFilesByEntry } = await import('$lib/services/contents/collection/files');
      const resolvePathMock = vi.mocked(resolvePath);
      const getAssociatedCollectionsMock = vi.mocked(getAssociatedCollections);
      const getCollectionFilesByEntryMock = vi.mocked(getCollectionFilesByEntry);

      const mockEntry = /** @type {any} */ ({
        slug: 'test',
        id: 'test',
        subPath: 'test.md',
        locales: {
          en: {
            path: 'content/test.md',
            content: { title: 'Test' },
          },
        },
      });

      const mockCollection = /** @type {any} */ ({
        name: 'posts',
        _i18n: { defaultLocale: 'en' },
      });

      const mockAsset = {
        path: 'content/image.jpg',
        name: 'image.jpg',
        kind: /** @type {import('$lib/types/private').AssetKind} */ ('image'),
        sha: 'abc123',
        size: 1024,
        folder: {
          internalPath: 'content',
          publicPath: '/content',
          collectionName: 'posts',
          entryRelative: false,
          hasTemplateTags: false,
        },
      };

      allAssets.set([mockAsset]);
      resolvePathMock.mockReturnValue('content/image.jpg');
      getAssociatedCollectionsMock.mockReturnValue([mockCollection]);
      getCollectionFilesByEntryMock.mockReturnValue([]);

      // Relative path (without leading slash)
      const relativeResult = getAssetByPath({
        value: 'image.jpg',
        entry: mockEntry,
        collectionName: 'posts',
      });

      expect(relativeResult).toEqual(mockAsset);
    });

    it('should handle regex patterns in allAssetFolders matching', async () => {
      const { stripSlashes } = await import('@sveltia/utils/string');
      const { getPathInfo } = await import('@sveltia/utils/file');
      const { getAssetFolder } = await import('$lib/services/assets/folders');
      const { createPath } = await import('$lib/services/utils/file');

      const mockAsset = {
        path: 'dynamic/media/photo.jpg',
        name: 'photo.jpg',
        sha: 'abc123',
        size: 1024,
        kind: /** @type {import('$lib/types/private').AssetKind} */ ('image'),
        folder: {
          internalPath: 'dynamic/media',
          publicPath: '/media',
          collectionName: undefined,
          entryRelative: false,
          hasTemplateTags: false,
        },
      };

      vi.mocked(stripSlashes).mockReturnValue('/media/photo.jpg');
      vi.mocked(getPathInfo).mockReturnValue({
        dirname: '/media',
        basename: 'photo.jpg',
        filename: 'photo',
        extension: '.jpg',
      });

      vi.mocked(getAssetFolder).mockReturnValue(undefined);
      vi.mocked(createPath).mockReturnValue('dynamic/media/photo.jpg');

      allAssets.set([mockAsset]);

      const result = getAssetByAbsolutePath({
        path: '/media/photo.jpg',
        entry: undefined,
        collectionName: 'posts',
        fileName: undefined,
      });

      expect(result).toEqual(mockAsset);
    });

    it('skips allAssetFolders folder whose publicPath does not match dirName', async () => {
      // Covers line 242 idx 1: the findLast predicate returns falsy when
      // dirName does not match the folder's publicPath pattern.
      const { stripSlashes } = await import('@sveltia/utils/string');
      const { getPathInfo } = await import('@sveltia/utils/file');
      const { getAssetFolder, allAssetFolders } = await import('$lib/services/assets/folders');

      vi.mocked(stripSlashes).mockReturnValue('/posts/images/photo.jpg');
      vi.mocked(getPathInfo).mockReturnValue({
        dirname: '/posts/images',
        basename: 'photo.jpg',
        filename: 'photo',
        extension: '.jpg',
      });
      vi.mocked(getAssetFolder).mockReturnValue(undefined);

      // The non-matching folder must be LAST because findLast iterates from the end —
      // if the matching folder is last, findLast returns it immediately without ever
      // evaluating the non-matching folder's predicate.
      // The folder without publicPath (undefined) also covers line 242 idx 1:
      // `folder.publicPath ?? ''` — the nullish coalescing fallback to ''.
      allAssetFolders.set(
        /** @type {any} */ ([
          {
            internalPath: 'content/posts/images',
            publicPath: '/posts/images',
            collectionName: 'posts',
            entryRelative: false,
            hasTemplateTags: false,
          },
          {
            internalPath: 'content/other',
            publicPath: undefined,
            collectionName: 'other',
            entryRelative: false,
            hasTemplateTags: false,
          },
        ]),
      );
      allAssets.set([]);

      const result = getAssetByAbsolutePath({
        path: '/posts/images/photo.jpg',
        entry: undefined,
        collectionName: 'posts',
        fileName: undefined,
      });

      // Asset not in allAssets → undefined; the test's purpose is to exercise the predicate
      expect(result).toBeUndefined();

      // Restore allAssetFolders
      allAssetFolders.set([]);
    });

    it('resolves template-tagged internalPath via entry associated collection', async () => {
      // Covers line 255 idx 1: _collectionName is falsy but entry is truthy,
      // so collection is resolved via getAssociatedCollections(entry)?.[0].
      const { stripSlashes } = await import('@sveltia/utils/string');
      const { getPathInfo } = await import('@sveltia/utils/file');
      const { getAssetFolder, allAssetFolders } = await import('$lib/services/assets/folders');
      const { getAssociatedCollections } = await import('$lib/services/contents/entry');
      const { createPath } = await import('$lib/services/utils/file');
      const { fillTemplate } = await import('$lib/services/common/template');

      const { isCollectionIndexFile } =
        await import('$lib/services/contents/collection/index-file');

      const mockEntry = /** @type {any} */ ({
        id: 'my-post',
        slug: 'my-post',
        locales: {
          en: {
            path: 'content/posts/my-post.md',
            content: { title: 'My Post' },
          },
        },
      });

      const mockCollection = /** @type {any} */ ({
        name: 'posts',
        _i18n: { defaultLocale: 'en' },
      });

      const mockAsset = {
        path: 'content/posts/my-post/media/photo.jpg',
        name: 'photo.jpg',
        sha: 'abc123',
        size: 1024,
        kind: /** @type {import('$lib/types/private').AssetKind} */ ('image'),
        folder: {
          internalPath: 'content/posts/my-post/media',
          publicPath: '/media',
          collectionName: undefined,
          entryRelative: false,
          hasTemplateTags: true,
        },
      };

      vi.mocked(stripSlashes).mockReturnValue('/media/photo.jpg');
      vi.mocked(getPathInfo).mockReturnValue({
        dirname: '/media',
        basename: 'photo.jpg',
        filename: 'photo',
        extension: '.jpg',
      });
      vi.mocked(getAssetFolder).mockReturnValue(undefined);
      // entry provides collection via getAssociatedCollections (covers line 255 idx 1)
      vi.mocked(getAssociatedCollections).mockReturnValue([mockCollection]);
      vi.mocked(isCollectionIndexFile).mockReturnValue(false);
      vi.mocked(fillTemplate).mockReturnValue('content/posts/my-post/media');
      // First createPath call: for the globalAssetFolder {} element — return non-matching path
      // so scanning continues to the template-tag folder.
      // Second call: after fillTemplate resolves internalPath to the actual folder.
      vi.mocked(createPath)
        .mockReturnValueOnce('no-match/photo.jpg')
        .mockReturnValueOnce('content/posts/my-post/media/photo.jpg');

      // Folder has no collectionName but has template tags in internalPath
      allAssetFolders.set([
        {
          internalPath: 'content/posts/{{slug}}/media',
          publicPath: '/media',
          collectionName: undefined, // no collectionName → triggers line 255
          entryRelative: false,
          hasTemplateTags: true,
        },
      ]);
      allAssets.set([mockAsset]);

      const result = getAssetByAbsolutePath({
        path: '/media/photo.jpg',
        entry: mockEntry,
        collectionName: 'posts',
        fileName: undefined,
      });

      expect(result).toEqual(mockAsset);
      expect(getAssociatedCollections).toHaveBeenCalledWith(mockEntry);

      // Restore store
      allAssetFolders.set([]);
    });

    it('returns undefined when template folder has no collectionName and no entry', async () => {
      // Covers line 257 idx 1: _collectionName is falsy and entry is also falsy,
      // so the inner ternary resolves to `undefined` (': undefined' branch).
      const { stripSlashes } = await import('@sveltia/utils/string');
      const { getPathInfo } = await import('@sveltia/utils/file');
      const { getAssetFolder, globalAssetFolder } = await import('$lib/services/assets/folders');

      vi.mocked(stripSlashes).mockReturnValue('/media/photo.jpg');
      vi.mocked(getPathInfo).mockReturnValue({
        dirname: '/media',
        basename: 'photo.jpg',
        filename: 'photo',
        extension: '.jpg',
      });
      // Return a folder with template tags but no collectionName
      vi.mocked(getAssetFolder).mockReturnValue(
        /** @type {any} */ ({
          internalPath: 'content/{{slug}}/media',
          publicPath: '/media',
          collectionName: undefined,
          entryRelative: false,
          hasTemplateTags: true,
        }),
      );
      /** @type {import('svelte/store').Writable<any>} */ (globalAssetFolder).set(undefined);
      allAssets.set([]);

      const result = getAssetByAbsolutePath({
        path: '/media/photo.jpg',
        entry: undefined, // falsy → inner ternary takes ': undefined' (line 257 idx 1)
        collectionName: 'posts',
        fileName: undefined,
      });

      // collection = undefined → template cannot be resolved → asset not found
      expect(result).toBeUndefined();

      /** @type {import('svelte/store').Writable<any>} */ (globalAssetFolder).set({});
    });
  });

  describe('isRelativePath', () => {
    it('should return true for simple filenames', () => {
      expect(isRelativePath('image.jpg')).toBe(true);
      expect(isRelativePath('document.pdf')).toBe(true);
      expect(isRelativePath('photo.png')).toBe(true);
    });

    it('should return true for relative paths with subdirectories', () => {
      expect(isRelativePath('images/photo.jpg')).toBe(true);
      expect(isRelativePath('assets/images/icon.svg')).toBe(true);
      expect(isRelativePath('folder/subfolder/file.txt')).toBe(true);
    });

    it('should return true for paths starting with . or ..', () => {
      expect(isRelativePath('./image.jpg')).toBe(true);
      expect(isRelativePath('../image.jpg')).toBe(true);
      expect(isRelativePath('./images/photo.jpg')).toBe(true);
      expect(isRelativePath('../../parent/image.jpg')).toBe(true);
    });

    it('should return true for empty string', () => {
      expect(isRelativePath('')).toBe(true);
    });

    it('should return false for absolute paths starting with /', () => {
      expect(isRelativePath('/images/photo.jpg')).toBe(false);
      expect(isRelativePath('/assets/document.pdf')).toBe(false);
      expect(isRelativePath('/')).toBe(false);
    });

    it('should return false for paths starting with @ (special case)', () => {
      expect(isRelativePath('@assets/images/photo.jpg')).toBe(false);
      expect(isRelativePath('@/images/icon.svg')).toBe(false);
      expect(isRelativePath('@media/file.txt')).toBe(false);
    });
  });
});
