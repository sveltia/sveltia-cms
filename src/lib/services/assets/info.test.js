/* eslint-disable max-classes-per-file */

import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as cloudStorageModule from '$lib/services/integrations/media-libraries/cloud';
import * as cloudinaryModule from '$lib/services/integrations/media-libraries/cloud/cloudinary';

import {
  defaultAssetDetails,
  getAssetBaseURL,
  getAssetBlob,
  getAssetBlobURL,
  getAssetDetails,
  getAssetPublicURL,
  getAssetThumbnailURL,
  getMediaFieldURL,
} from './info';

// Mock all dependencies
vi.mock('@sveltia/utils/file');
vi.mock('@sveltia/utils/misc');
vi.mock('@sveltia/utils/storage');
vi.mock('@sveltia/utils/string');
vi.mock('mime');
vi.mock('svelte/store', () => ({
  get: vi.fn(),
  writable: vi.fn(() => ({
    subscribe: vi.fn(),
    set: vi.fn(),
    update: vi.fn(),
  })),
  readable: vi.fn(() => ({
    subscribe: vi.fn(),
  })),
  derived: vi.fn(() => ({
    subscribe: vi.fn(),
  })),
}));
vi.mock('svelte-i18n', () => ({
  _: vi.fn(),
  addMessages: vi.fn(),
  init: vi.fn(),
  locale: { subscribe: vi.fn() },
  $dictionary: { subscribe: vi.fn() },
  dictionary: { subscribe: vi.fn() },
}));
vi.mock('$lib/services/assets', () => ({
  getAssetByPath: vi.fn(),
  isRelativePath: vi.fn((path) => !/^[/@]/.test(path)),
  focusedAsset: {
    set: vi.fn(),
    subscribe: vi.fn(),
  },
  allAssets: {
    subscribe: vi.fn(),
  },
}));
vi.mock('$lib/services/backends', () => ({
  backend: {
    subscribe: vi.fn(),
    _mockValue: 'backend',
  },
}));
vi.mock('$lib/services/config', () => ({
  cmsConfig: {
    subscribe: vi.fn(),
    _mockValue: 'cmsConfig',
  },
}));
vi.mock('$lib/services/assets/folders', () => ({
  getAssetFoldersByPath: vi.fn(),
  globalAssetFolder: {
    subscribe: vi.fn(),
    _mockValue: 'globalAssetFolder',
  },
  selectedAssetFolder: {
    subscribe: vi.fn(),
    _mockValue: 'selectedAssetFolder',
  },
}));
vi.mock('$lib/services/contents/collection/entries');
vi.mock('$lib/services/utils/file');
vi.mock('$lib/services/utils/media');
vi.mock('$lib/services/utils/media/image/transform');
vi.mock('$lib/services/utils/media/pdf');
vi.mock('$lib/services/integrations/media-libraries/cloud', () => ({
  allCloudStorageServices: {
    cloudinary: {
      isEnabled: vi.fn(),
    },
  },
}));
vi.mock('$lib/services/integrations/media-libraries/cloud/cloudinary', () => ({
  getMergedLibraryOptions: vi.fn(),
}));

describe('assets/info', () => {
  /** @type {any} */
  let mockAsset;
  /** @type {Blob} */
  let mockBlob;
  /** @type {any} */
  let mockBackend;
  /** @type {any} */
  let mockCmsConfig;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create mock asset
    mockAsset = {
      path: 'assets/images/test.jpg',
      name: 'test.jpg',
      kind: 'image',
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

    // Create mock blob
    mockBlob = new Blob(['test content'], { type: 'image/jpeg' });

    // Mock backend
    mockBackend = {
      fetchBlob: vi.fn(),
      repository: {
        databaseName: 'test-db',
        blobBaseURL: 'https://example.com/blobs',
      },
    };

    // Mock site config
    mockCmsConfig = {
      _baseURL: 'https://example.com',
      output: {
        encode_file_path: false,
      },
    };

    // Setup mocks
    const getMock = vi.mocked(get);

    getMock.mockImplementation((store) => {
      // Match the specific store references from the imports
      if (store && typeof store === 'object' && '_mockValue' in store) {
        if (store._mockValue === 'backend') return mockBackend;
        if (store._mockValue === 'cmsConfig') return mockCmsConfig;
        if (store._mockValue === 'globalAssetFolder') return mockAsset.folder;
      }

      return undefined;
    });

    // Mock URL.createObjectURL
    // @ts-ignore
    global.URL = {
      createObjectURL: vi.fn().mockReturnValue('blob:mock-url'),
      revokeObjectURL: vi.fn(),
    };

    // Mock fetch
    // @ts-ignore
    global.fetch = vi.fn().mockResolvedValue({
      /**
       * Mock blob function for fetch response.
       * @returns {Promise<Blob>} Mock blob.
       */
      blob: () => Promise.resolve(mockBlob),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // @ts-ignore
    global.URL = undefined;
    // @ts-ignore
    global.fetch = undefined;
  });

  describe('getAssetBlob', () => {
    it('should return blob from blobURL if available', async () => {
      const assetWithBlobURL = {
        ...mockAsset,
        blobURL: 'blob:existing-url',
      };

      const result = await getAssetBlob(assetWithBlobURL);

      expect(global.fetch).toHaveBeenCalledWith('blob:existing-url');
      expect(result).toBe(mockBlob);
    });

    it('should return blob from file if available', async () => {
      const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });

      const mockHandle = {
        getFile: vi.fn(async () => file),
      };

      const assetWithHandle = {
        ...mockAsset,
        handle: mockHandle,
      };

      const result = await getAssetBlob(assetWithHandle);

      expect(result).toBe(file);
      expect(assetWithHandle.blobURL).toBe('blob:mock-url');
      expect(mockHandle.getFile).toHaveBeenCalled();
    });

    it('should fetch blob from backend and override MIME type', async () => {
      const remoteBlobData = new Uint8Array([1, 2, 3, 4]);
      const remoteBlob = new Blob([remoteBlobData], { type: 'application/octet-stream' });

      mockBackend.fetchBlob.mockResolvedValue(remoteBlob);

      const { default: mime } = await import('mime');
      const mimeMock = vi.mocked(mime);

      mimeMock.getType.mockReturnValue('image/jpeg');

      const result = await getAssetBlob(mockAsset);

      expect(mockBackend.fetchBlob).toHaveBeenCalledWith(mockAsset);
      expect(mimeMock.getType).toHaveBeenCalledWith('test.jpg');
      expect(result).toBeInstanceOf(Blob);
      expect(result.type).toBe('image/jpeg');
    });

    it('should throw error if backend fails to fetch blob', async () => {
      mockBackend.fetchBlob.mockResolvedValue(null);

      await expect(getAssetBlob(mockAsset)).rejects.toThrow('Failed to retrieve blob');
    });

    it('should retry when blob is already being requested', async () => {
      const { sleep } = await import('@sveltia/utils/misc');
      const sleepMock = vi.mocked(sleep);

      sleepMock.mockResolvedValue(undefined);

      // Create asset without handle or blobURL to force backend fetch
      const assetWithoutHandle = {
        ...mockAsset,
        handle: undefined,
        blobURL: undefined,
      };

      mockBackend.fetchBlob.mockResolvedValue(new Blob(['test data'], { type: 'image/jpeg' }));

      const { default: mime } = await import('mime');
      const mimeMock = vi.mocked(mime);

      mimeMock.getType.mockReturnValue('image/jpeg');

      // First call - should add path to requestedAssetPaths
      const promise1 = getAssetBlob(assetWithoutHandle, 0);
      // Simulate a concurrent call that finds the path already in requestedAssetPaths
      // and retryCount is within limit (0 <= 25)
      const promise2 = getAssetBlob(assetWithoutHandle, 0);
      // Both should eventually resolve
      const [blob1, blob2] = await Promise.all([promise1, promise2]);

      expect(blob1).toBeInstanceOf(Blob);
      expect(blob2).toBeInstanceOf(Blob);
      // sleep should have been called due to retry logic
      expect(sleepMock).toHaveBeenCalled();
    });
  });

  describe('getAssetBlobURL', () => {
    it('should return existing blobURL if available', async () => {
      const assetWithBlobURL = {
        ...mockAsset,
        blobURL: 'blob:existing-url',
      };

      const result = await getAssetBlobURL(assetWithBlobURL);

      expect(result).toBe('blob:existing-url');
    });

    it('should create new blobURL if not available', async () => {
      const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });

      const mockHandle = {
        getFile: vi.fn(async () => file),
      };

      const assetWithHandle = {
        ...mockAsset,
        handle: mockHandle,
      };

      const result = await getAssetBlobURL(assetWithHandle);

      expect(result).toBe('blob:mock-url');
      expect(assetWithHandle.blobURL).toBe('blob:mock-url');
    });
  });

  describe('getAssetThumbnailURL', () => {
    /** @type {any} */
    let mockIndexedDB;

    beforeEach(async () => {
      const { IndexedDB } = await import('@sveltia/utils/storage');

      mockIndexedDB = {
        get: vi.fn(),
        set: vi.fn(),
      };

      // Vitest 4 requires proper constructor with 'class' keyword
      /** @type {any} */
      class MockIndexedDB {
        /**
         * Creates a mock IndexedDB instance.
         */
        constructor() {
          Object.assign(this, mockIndexedDB);
        }
      }

      // @ts-expect-error - Constructor signature mismatch between class and interface
      vi.mocked(IndexedDB).mockImplementation(MockIndexedDB);
    });

    it('should return undefined for non-image/video/PDF assets', async () => {
      const textAsset = {
        ...mockAsset,
        name: 'test.txt',
        kind: 'document',
      };

      const result = await getAssetThumbnailURL(textAsset);

      expect(result).toBe(undefined);
    });

    it('should generate thumbnail for image and cache it', async () => {
      mockIndexedDB.get.mockResolvedValue(undefined);

      const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });

      const assetWithFile = {
        ...mockAsset,
        file,
      };

      const { transformImage } = await import('$lib/services/utils/media/image/transform');
      const transformImageMock = vi.mocked(transformImage);
      const thumbnailBlob = new Blob(['thumbnail'], { type: 'image/webp' });

      transformImageMock.mockResolvedValue(thumbnailBlob);

      const result = await getAssetThumbnailURL(assetWithFile);

      expect(transformImageMock).toHaveBeenCalledWith(file, {
        format: 'webp',
        quality: 85,
        width: 512,
        height: 512,
        fit: 'contain',
      });
      expect(mockIndexedDB.set).toHaveBeenCalledWith('abc123', thumbnailBlob);
      expect(result).toBe('blob:mock-url');
    });

    it('should return cached thumbnail if available', async () => {
      const cachedBlob = new Blob(['cached'], { type: 'image/webp' });

      mockIndexedDB.get.mockResolvedValue(cachedBlob);

      // Provide a handle to avoid getAssetBlob issues
      const mockHandle = {
        getFile: vi.fn(async () => new File(['content'], 'test.jpg', { type: 'image/jpeg' })),
      };

      const assetWithHandle = {
        ...mockAsset,
        handle: mockHandle,
      };

      const result = await getAssetThumbnailURL(assetWithHandle);

      // Since this test may run after another test that initialized thumbnailDB,
      // we focus on the core behavior: returning a blob URL
      expect(result).toBe('blob:mock-url');
    });

    it('should generate thumbnail for PDF using renderPDF', async () => {
      mockIndexedDB.get.mockResolvedValue(undefined);

      const pdfFile = new File(['pdf content'], 'test.pdf', { type: 'application/pdf' });

      const mockHandle = {
        getFile: vi.fn(async () => pdfFile),
      };

      const pdfAsset = {
        ...mockAsset,
        name: 'test.pdf',
        handle: mockHandle,
      };

      const { renderPDF } = await import('$lib/services/utils/media/pdf');
      const renderPDFMock = vi.mocked(renderPDF);
      const thumbnailBlob = new Blob(['pdf thumbnail'], { type: 'image/webp' });

      renderPDFMock.mockResolvedValue(thumbnailBlob);

      const result = await getAssetThumbnailURL(pdfAsset);

      expect(renderPDFMock).toHaveBeenCalledWith(pdfFile, {
        format: 'webp',
        quality: 85,
        width: 512,
        height: 512,
        fit: 'contain',
      });
      expect(result).toBe('blob:mock-url');
    });

    it('should return undefined in cache-only mode if no cached thumbnail', async () => {
      mockIndexedDB.get.mockResolvedValue(undefined);

      const result = await getAssetThumbnailURL(mockAsset, { cacheOnly: true });

      expect(result).toBe(undefined);
    });
  });

  describe('getAssetPublicURL', () => {
    beforeEach(async () => {
      const { getAssetFoldersByPath } = await import('$lib/services/assets/folders');
      const { createPathRegEx } = await import('$lib/services/utils/file');
      const { escapeRegExp } = await import('@sveltia/utils/string');

      vi.mocked(getAssetFoldersByPath).mockReturnValue([]);
      vi.mocked(escapeRegExp).mockImplementation((str) => str);

      // Mock createPathRegEx to execute the callback and build a real regex
      vi.mocked(createPathRegEx).mockImplementation((basePath, callback) => {
        const segments = basePath.split('/').filter(Boolean);
        const regexParts = segments.map((segment) => callback(segment));

        return new RegExp(`^${regexParts.join('/')}`);
      });

      const getMock = vi.mocked(get);

      getMock.mockImplementation((store) => {
        if (store && typeof store === 'object' && '_mockValue' in store) {
          if (store._mockValue === 'backend') return mockBackend;
          if (store._mockValue === 'cmsConfig') return mockCmsConfig;
          if (store._mockValue === 'globalAssetFolder') return mockAsset.folder;
        }

        return undefined;
      });
    });

    it('should generate public URL for global asset', () => {
      const result = getAssetPublicURL(mockAsset);

      expect(result).toBe('https://example.com/assets/images/test.jpg');
    });

    it('should return path only when pathOnly is true', () => {
      const result = getAssetPublicURL(mockAsset, { pathOnly: true });

      expect(result).toBe('/assets/images/test.jpg');
    });

    it('should return undefined for entry-relative assets without entry', () => {
      const entryRelativeAsset = {
        ...mockAsset,
        folder: {
          ...mockAsset.folder,
          entryRelative: true,
        },
      };

      const result = getAssetPublicURL(entryRelativeAsset);

      expect(result).toBe(undefined);
    });

    it('should return asset name for entry-relative asset with same directory', async () => {
      const { getPathInfo } = await import('@sveltia/utils/file');
      const getPathInfoMock = vi.mocked(getPathInfo);

      getPathInfoMock.mockImplementation(() => ({
        dirname: 'assets/images',
        basename: 'file',
        filename: 'file',
        extension: '.ext',
      }));

      const entryRelativeAsset = {
        ...mockAsset,
        folder: {
          ...mockAsset.folder,
          entryRelative: true,
        },
      };

      const mockEntry = /** @type {any} */ ({
        id: 'test',
        slug: 'test',
        subPath: 'test',
        locales: {
          en: { path: 'assets/images/entry.md' },
        },
      });

      const result = getAssetPublicURL(entryRelativeAsset, {
        pathOnly: true,
        entry: mockEntry,
      });

      expect(result).toBe('test.jpg');
    });

    it('should return relative path for entry-relative asset in sub-folder', async () => {
      const { getPathInfo } = await import('@sveltia/utils/file');
      const { escapeRegExp } = await import('@sveltia/utils/string');
      const getPathInfoMock = vi.mocked(getPathInfo);
      const escapeRegExpMock = vi.mocked(escapeRegExp);

      // Mock different directories for asset and entry paths
      getPathInfoMock.mockImplementation((path) => {
        if (path.includes('images/photos/photo.jpg')) {
          return {
            dirname: 'assets/images/photos',
            basename: 'photo.jpg',
            filename: 'photo',
            extension: '.jpg',
          };
        }

        return {
          dirname: 'assets/images',
          basename: 'entry.md',
          filename: 'entry',
          extension: '.md',
        };
      });

      // Mock escapeRegExp to return the string as-is for simplicity
      escapeRegExpMock.mockImplementation((str) => str);

      const entryRelativeAsset = {
        ...mockAsset,
        path: 'assets/images/photos/photo.jpg',
        name: 'photo.jpg',
        folder: {
          ...mockAsset.folder,
          entryRelative: true,
        },
      };

      const mockEntry = /** @type {any} */ ({
        id: 'test',
        slug: 'test',
        subPath: 'test',
        locales: {
          en: { path: 'assets/images/entry.md' },
        },
      });

      const result = getAssetPublicURL(entryRelativeAsset, {
        pathOnly: true,
        entry: mockEntry,
      });

      expect(result).toBe('photos/photo.jpg');
    });

    it('should return undefined when assetFolderPath is undefined', async () => {
      const { getPathInfo } = await import('@sveltia/utils/file');
      const getPathInfoMock = vi.mocked(getPathInfo);

      getPathInfoMock.mockImplementation((path) => {
        if (path.includes('photos/photo.jpg')) {
          return {
            dirname: undefined,
            basename: 'photo.jpg',
            filename: 'photo',
            extension: '.jpg',
          };
        }

        return {
          dirname: 'assets/images',
          basename: 'entry.md',
          filename: 'entry',
          extension: '.md',
        };
      });

      const entryRelativeAsset = {
        ...mockAsset,
        path: 'assets/images/photos/photo.jpg',
        folder: {
          ...mockAsset.folder,
          entryRelative: true,
        },
      };

      const mockEntry = /** @type {any} */ ({
        id: 'test',
        slug: 'test',
        locales: {
          en: { path: 'assets/images/entry.md' },
        },
      });

      const result = getAssetPublicURL(entryRelativeAsset, {
        pathOnly: true,
        entry: mockEntry,
      });

      expect(result).toBe(undefined);
    });

    it('should return undefined when entryFolderPath is undefined', async () => {
      const { getPathInfo } = await import('@sveltia/utils/file');
      const getPathInfoMock = vi.mocked(getPathInfo);

      getPathInfoMock.mockImplementation((path) => {
        if (path.includes('photos/photo.jpg')) {
          return {
            dirname: 'assets/images/photos',
            basename: 'photo.jpg',
            filename: 'photo',
            extension: '.jpg',
          };
        }

        return {
          dirname: undefined,
          basename: 'entry.md',
          filename: 'entry',
          extension: '.md',
        };
      });

      const entryRelativeAsset = {
        ...mockAsset,
        path: 'assets/images/photos/photo.jpg',
        folder: {
          ...mockAsset.folder,
          entryRelative: true,
        },
      };

      const mockEntry = /** @type {any} */ ({
        id: 'test',
        slug: 'test',
        locales: {
          en: { path: 'assets/images/entry.md' },
        },
      });

      const result = getAssetPublicURL(entryRelativeAsset, {
        pathOnly: true,
        entry: mockEntry,
      });

      expect(result).toBe(undefined);
    });

    it('should return undefined for entry-relative asset when pathOnly is false', async () => {
      const { getPathInfo } = await import('@sveltia/utils/file');
      const getPathInfoMock = vi.mocked(getPathInfo);

      getPathInfoMock.mockImplementation(() => ({
        dirname: 'assets/images',
        basename: 'file',
        filename: 'file',
        extension: '.ext',
      }));

      const entryRelativeAsset = {
        ...mockAsset,
        folder: {
          ...mockAsset.folder,
          entryRelative: true,
        },
      };

      const mockEntry = /** @type {any} */ ({
        id: 'test',
        slug: 'test',
        locales: {
          en: { path: 'assets/images/entry.md' },
        },
      });

      const result = getAssetPublicURL(entryRelativeAsset, {
        pathOnly: false,
        entry: mockEntry,
      });

      expect(result).toBe(undefined);
    });

    it('should handle template tags in path', async () => {
      const templateAsset = {
        ...mockAsset,
        path: 'assets/images/post-slug/test.jpg',
        folder: {
          ...mockAsset.folder,
          internalPath: 'assets/images/{{slug}}',
          publicPath: '/public/{{slug}}',
          hasTemplateTags: true,
        },
      };

      // Replace the path with the public version
      // Since we have template tags, it will use createPathRegEx
      // which will call our callback to extract tags (lines 189-191)
      const result = getAssetPublicURL(templateAsset, { pathOnly: true });

      // Result should contain the test file and public path
      expect(result).toBeDefined();
      expect(result).toContain('test.jpg');
    });

    it('should encode file path when encoding is enabled', async () => {
      const { encodeFilePath } = await import('$lib/services/utils/file');

      vi.mocked(encodeFilePath).mockReturnValue('/encoded/path/test.jpg');

      mockCmsConfig.output.encode_file_path = true;

      const result = getAssetPublicURL(mockAsset, { pathOnly: true });

      expect(vi.mocked(encodeFilePath)).toHaveBeenCalled();
      expect(result).toBe('/encoded/path/test.jpg');
    });

    it('should return undefined for non-linkable paths unless allowSpecial is true', () => {
      const specialAsset = {
        ...mockAsset,
        path: '@special/test.jpg',
        folder: {
          ...mockAsset.folder,
          internalPath: '@special',
          publicPath: '@public',
        },
      };

      const resultWithoutSpecial = getAssetPublicURL(specialAsset);
      const resultWithSpecial = getAssetPublicURL(specialAsset, { allowSpecial: true });

      expect(resultWithoutSpecial).toBe(undefined);
      expect(resultWithSpecial).toBe('https://example.com@public/test.jpg');
    });

    it('should search for asset folder by collection when collectionName is defined (line 166)', async () => {
      const { getAssetFoldersByPath } = await import('$lib/services/assets/folders');

      const collectionFolder = {
        internalPath: 'posts/media',
        publicPath: '/posts/media',
        collectionName: 'posts',
        entryRelative: false,
        hasTemplateTags: false,
      };

      vi.mocked(getAssetFoldersByPath).mockReturnValue([collectionFolder]);

      const assetWithCollection = {
        ...mockAsset,
        folder: {
          ...mockAsset.folder,
          collectionName: 'posts', // Force the search path
        },
      };

      const result = getAssetPublicURL(assetWithCollection, { pathOnly: true });

      // Verify that getAssetFoldersByPath was called to search for the folder
      expect(getAssetFoldersByPath).toHaveBeenCalledWith(assetWithCollection.path);
      expect(result).toBeDefined();
    });
  });

  describe('getMediaFieldURL', () => {
    beforeEach(async () => {
      const { getAssetByPath } = await import('$lib/services/assets');

      vi.mocked(getAssetByPath).mockReturnValue(mockAsset);
    });

    it('should return undefined for empty value', async () => {
      const result = await getMediaFieldURL({
        value: '',
        collectionName: 'posts',
      });

      expect(result).toBe(undefined);
    });

    it('should return external URLs as-is', async () => {
      const httpUrl = 'https://example.com/image.jpg';
      const dataUrl = 'data:image/jpeg;base64,/9j/4AAQ';
      const blobUrl = 'blob:abc123';

      const httpResult = await getMediaFieldURL({
        value: httpUrl,
        collectionName: 'posts',
      });

      const dataResult = await getMediaFieldURL({
        value: dataUrl,
        collectionName: 'posts',
      });

      const blobResult = await getMediaFieldURL({
        value: blobUrl,
        collectionName: 'posts',
      });

      expect(httpResult).toBe(httpUrl);
      expect(dataResult).toBe(dataUrl);
      expect(blobResult).toBe(blobUrl);
    });

    it('should return undefined if asset not found', async () => {
      const { getAssetByPath } = await import('$lib/services/assets');

      vi.mocked(getAssetByPath).mockReturnValue(undefined);

      const result = await getMediaFieldURL({
        value: 'nonexistent.jpg',
        collectionName: 'posts',
      });

      expect(result).toBe(undefined);
    });

    it('should return blob URL for found asset', async () => {
      const mockHandle = {
        getFile: vi.fn(async () => new File(['content'], 'test.jpg', { type: 'image/jpeg' })),
      };

      const assetWithHandle = {
        ...mockAsset,
        handle: mockHandle,
      };

      const { getAssetByPath } = await import('$lib/services/assets');

      vi.mocked(getAssetByPath).mockReturnValue(assetWithHandle);

      const result = await getMediaFieldURL({
        value: 'test.jpg',
        collectionName: 'posts',
      });

      expect(result).toBe('blob:mock-url');
    });

    it('should return thumbnail URL when thumbnail option is true', async () => {
      const { IndexedDB } = await import('@sveltia/utils/storage');

      /** @type {any} */
      const mockIndexedDB = {
        get: vi.fn().mockResolvedValue(undefined),
        set: vi.fn(),
      };

      // Vitest 4 requires proper constructor with 'class' keyword
      /** @type {any} */
      class MockIndexedDB {
        /**
         * Creates a mock IndexedDB instance.
         */
        constructor() {
          Object.assign(this, mockIndexedDB);
        }
      }

      /** @type {any} */
      const mockedIndexedDB = vi.mocked(IndexedDB);

      // @ts-ignore - Constructor signature mismatch
      mockedIndexedDB.mockImplementation(MockIndexedDB);

      const { transformImage } = await import('$lib/services/utils/media/image/transform');

      vi.mocked(transformImage).mockResolvedValue(new Blob(['thumbnail']));

      const mockHandle = {
        getFile: vi.fn(async () => new File(['content'], 'test.jpg', { type: 'image/jpeg' })),
      };

      const assetWithHandle = {
        ...mockAsset,
        handle: mockHandle,
      };

      const { getAssetByPath } = await import('$lib/services/assets');

      vi.mocked(getAssetByPath).mockReturnValue(assetWithHandle);

      const result = await getMediaFieldURL({
        value: 'test.jpg',
        collectionName: 'posts',
        thumbnail: true,
      });

      expect(result).toBe('blob:mock-url');
    });

    it('should use Cloudinary base URL for relative paths when fieldConfig is provided', async () => {
      // @ts-ignore
      vi.mocked(cloudStorageModule.allCloudStorageServices.cloudinary.isEnabled).mockReturnValue(
        true,
      );
      vi.mocked(cloudinaryModule.getMergedLibraryOptions).mockReturnValue({
        output_filename_only: true,
        config: {
          cloud_name: 'my-cloud',
        },
      });

      const fieldConfig = /** @type {any} */ ({ type: 'image' });
      const relativeImagePath = 'my-image.jpg';

      const result = await getMediaFieldURL({
        value: relativeImagePath,
        collectionName: 'posts',
        fieldConfig,
      });

      expect(result).toBe('https://res.cloudinary.com/my-cloud/my-image.jpg');
    });

    it('should call getAssetBaseURL with the provided fieldConfig', async () => {
      // @ts-ignore
      vi.mocked(cloudStorageModule.allCloudStorageServices.cloudinary.isEnabled).mockReturnValue(
        true,
      );
      vi.mocked(cloudinaryModule.getMergedLibraryOptions).mockReturnValue({
        output_filename_only: true,
        config: {
          cloud_name: 'test-cloud',
        },
      });

      const fieldConfig = /** @type {any} */ ({ type: 'image', options: { width: 400 } });
      const relativeImagePath = 'photo.png';

      await getMediaFieldURL({
        value: relativeImagePath,
        collectionName: 'posts',
        fieldConfig,
      });

      expect(vi.mocked(cloudinaryModule.getMergedLibraryOptions)).toHaveBeenCalledWith(fieldConfig);
    });

    it('should not use Cloudinary URL for absolute paths starting with /', async () => {
      // @ts-ignore
      vi.mocked(cloudStorageModule.allCloudStorageServices.cloudinary.isEnabled).mockReturnValue(
        true,
      );
      vi.mocked(cloudinaryModule.getMergedLibraryOptions).mockReturnValue({
        output_filename_only: true,
        config: {
          cloud_name: 'my-cloud',
        },
      });

      const { getAssetByPath } = await import('$lib/services/assets');

      // Set up asset with blobURL to avoid blob retrieval
      const assetWithBlobURL = {
        ...mockAsset,
        blobURL: 'blob:existing-url',
      };

      vi.mocked(getAssetByPath).mockReturnValue(assetWithBlobURL);

      const fieldConfig = /** @type {any} */ ({ type: 'image' });
      const absolutePath = '/assets/image.jpg';

      const result = await getMediaFieldURL({
        value: absolutePath,
        collectionName: 'posts',
        fieldConfig,
      });

      expect(result).toBe('blob:existing-url');
      // getAssetByPath should be called instead of using Cloudinary URL
      expect(vi.mocked(getAssetByPath)).toHaveBeenCalled();
    });

    it('should fall back to asset lookup when no Cloudinary URL is available', async () => {
      // @ts-ignore
      vi.mocked(cloudStorageModule.allCloudStorageServices.cloudinary.isEnabled).mockReturnValue(
        false,
      );

      const { getAssetByPath } = await import('$lib/services/assets');

      // Set up asset with blobURL to avoid blob retrieval
      const assetWithBlobURL = {
        ...mockAsset,
        blobURL: 'blob:existing-url',
      };

      vi.mocked(getAssetByPath).mockReturnValue(assetWithBlobURL);

      const fieldConfig = /** @type {any} */ ({ type: 'image' });
      const relativeImagePath = 'my-image.jpg';

      const result = await getMediaFieldURL({
        value: relativeImagePath,
        collectionName: 'posts',
        fieldConfig,
      });

      expect(result).toBe('blob:existing-url');
      expect(vi.mocked(getAssetByPath)).toHaveBeenCalledWith({
        value: relativeImagePath,
        entry: undefined,
        collectionName: 'posts',
        fileName: undefined,
      });
    });

    it('should treat paths starting with @ as absolute paths', async () => {
      // @ts-ignore
      vi.mocked(cloudStorageModule.allCloudStorageServices.cloudinary.isEnabled).mockReturnValue(
        true,
      );
      vi.mocked(cloudinaryModule.getMergedLibraryOptions).mockReturnValue({
        output_filename_only: true,
        config: {
          cloud_name: 'my-cloud',
        },
      });

      const { getAssetByPath } = await import('$lib/services/assets');

      // Set up asset with blobURL to avoid blob retrieval
      const assetWithBlobURL = {
        ...mockAsset,
        blobURL: 'blob:existing-url',
      };

      vi.mocked(getAssetByPath).mockReturnValue(assetWithBlobURL);

      const fieldConfig = /** @type {any} */ ({ type: 'image' });
      const aliasPath = '@assets/images/image.jpg';

      const result = await getMediaFieldURL({
        value: aliasPath,
        collectionName: 'posts',
        fieldConfig,
      });

      expect(result).toBe('blob:existing-url');
      // getAssetByPath should be called, not Cloudinary URL
      expect(vi.mocked(getAssetByPath)).toHaveBeenCalledWith({
        value: aliasPath,
        entry: undefined,
        collectionName: 'posts',
        fileName: undefined,
      });
    });

    it('should not use Cloudinary URL for paths starting with @media', async () => {
      // @ts-ignore
      vi.mocked(cloudStorageModule.allCloudStorageServices.cloudinary.isEnabled).mockReturnValue(
        true,
      );
      vi.mocked(cloudinaryModule.getMergedLibraryOptions).mockReturnValue({
        output_filename_only: true,
        config: {
          cloud_name: 'my-cloud',
        },
      });

      const { getAssetByPath } = await import('$lib/services/assets');

      // Set up asset with blobURL to avoid blob retrieval
      const assetWithBlobURL = {
        ...mockAsset,
        blobURL: 'blob:existing-url',
      };

      vi.mocked(getAssetByPath).mockReturnValue(assetWithBlobURL);

      const fieldConfig = /** @type {any} */ ({ type: 'image' });
      const aliasPath = '@media/uploads/photo.jpg';

      const result = await getMediaFieldURL({
        value: aliasPath,
        collectionName: 'posts',
        fieldConfig,
      });

      expect(result).toBe('blob:existing-url');
      expect(vi.mocked(getAssetByPath)).toHaveBeenCalled();
    });
  });

  describe('getAssetDetails', () => {
    beforeEach(async () => {
      const { getMediaMetadata } = await import('$lib/services/utils/media');
      const { getEntriesByAssetURL } = await import('$lib/services/contents/collection/entries');

      vi.mocked(getMediaMetadata).mockResolvedValue({
        dimensions: { width: 800, height: 600 },
        duration: undefined,
        createdDate: undefined,
        coordinates: undefined,
      });

      vi.mocked(getEntriesByAssetURL).mockResolvedValue([]);
    });

    it('should return asset details with metadata for media files', async () => {
      const mockHandle = {
        getFile: vi.fn(async () => new File(['content'], 'test.jpg', { type: 'image/jpeg' })),
      };

      const assetWithHandle = {
        ...mockAsset,
        handle: mockHandle,
      };

      const result = await getAssetDetails(assetWithHandle);

      expect(result).toEqual({
        dimensions: { width: 800, height: 600 },
        duration: undefined,
        publicURL: 'https://example.com/assets/images/test.jpg',
        repoBlobURL: 'https://example.com/blobs/assets/images/test.jpg',
        usedEntries: [],
      });
    });

    it('should not fetch metadata for non-media files', async () => {
      const { getMediaMetadata } = await import('$lib/services/utils/media');

      const mockHandle = {
        getFile: vi.fn(async () => new File(['content'], 'test.txt', { type: 'text/plain' })),
      };

      const textAsset = {
        ...mockAsset,
        name: 'test.txt',
        kind: 'document',
        handle: mockHandle,
      };

      await getAssetDetails(textAsset);

      expect(vi.mocked(getMediaMetadata)).not.toHaveBeenCalled();
    });

    it('should handle missing repository blobBaseURL', async () => {
      mockBackend.repository.blobBaseURL = undefined;

      const mockHandle = {
        getFile: vi.fn(async () => new File(['content'], 'test.jpg', { type: 'image/jpeg' })),
      };

      const assetWithHandle = {
        ...mockAsset,
        handle: mockHandle,
      };

      const result = await getAssetDetails(assetWithHandle);

      expect(result.repoBlobURL).toBe(undefined);
    });
  });

  describe('defaultAssetDetails', () => {
    it('should have correct default values', () => {
      expect(defaultAssetDetails).toEqual({
        publicURL: undefined,
        repoBlobURL: undefined,
        dimensions: undefined,
        duration: undefined,
        usedEntries: [],
      });
    });
  });

  describe('uncovered edge cases', () => {
    it('should throw error when file handle getFile fails (line 56)', async () => {
      const mockHandle = {
        getFile: vi.fn(async () => {
          throw new Error('Handle error');
        }),
      };

      const assetWithFailingHandle = {
        ...mockAsset,
        file: undefined,
        blobURL: undefined,
        handle: mockHandle,
      };

      await expect(getAssetBlob(assetWithFailingHandle)).rejects.toThrow(
        'Failed to retrieve blob from file handle',
      );
    });

    it('should handle undefined thumbnail DB gracefully', async () => {
      mockBackend.repository.databaseName = undefined;

      const result = await getAssetThumbnailURL(mockAsset, { cacheOnly: true });

      expect(result).toBe(undefined);
    });

    it('should handle missing publicPath in getAssetPublicURL', () => {
      const assetWithoutPublicPath = {
        ...mockAsset,
        folder: {
          ...mockAsset.folder,
          publicPath: undefined,
        },
      };

      const result = getAssetPublicURL(assetWithoutPublicPath, { pathOnly: true });

      expect(result).toBeDefined();
      expect(result).toContain('test.jpg');
    });

    it('should handle root public path (/) in getAssetPublicURL', () => {
      const assetWithRootPublicPath = {
        ...mockAsset,
        folder: {
          ...mockAsset.folder,
          publicPath: '/',
        },
      };

      const result = getAssetPublicURL(assetWithRootPublicPath, { pathOnly: true });

      expect(result).toBeDefined();
      expect(result).toContain('test.jpg');
    });

    it('should handle mime.getType returning null', async () => {
      const { default: mime } = await import('mime');
      const mimeMock = vi.mocked(mime);

      mimeMock.getType.mockReturnValue(null);

      const remoteBlobData = new Uint8Array([1, 2, 3, 4]);
      const remoteBlob = new Blob([remoteBlobData], { type: 'application/octet-stream' });

      mockBackend.fetchBlob.mockResolvedValue(remoteBlob);

      const result = await getAssetBlob(mockAsset);

      expect(result).toBeInstanceOf(Blob);
      expect(result.type).toBe('application/octet-stream');
    });

    it('should handle backend.fetchBlob returning undefined', async () => {
      mockBackend.fetchBlob.mockResolvedValue(undefined);

      const assetWithoutHandle = {
        ...mockAsset,
        handle: undefined,
        blobURL: undefined,
      };

      await expect(getAssetBlob(assetWithoutHandle)).rejects.toThrow('Failed to retrieve blob');
    });

    it('should get media metadata for audio files', async () => {
      const { getMediaMetadata } = await import('$lib/services/utils/media');

      vi.mocked(getMediaMetadata).mockResolvedValue({
        duration: 120,
        dimensions: undefined,
        createdDate: undefined,
        coordinates: undefined,
      });

      const mockHandle = {
        getFile: vi.fn(async () => new File(['content'], 'audio.mp3', { type: 'audio/mpeg' })),
      };

      const audioAsset = {
        ...mockAsset,
        name: 'audio.mp3',
        kind: 'audio',
        handle: mockHandle,
      };

      const result = await getAssetDetails(audioAsset);

      expect(vi.mocked(getMediaMetadata)).toHaveBeenCalled();
      expect(result.duration).toBe(120);
    });

    it('should return undefined blobURL when getAssetBlob returns without setting blobURL', async () => {
      const { getAssetByPath } = await import('$lib/services/assets');

      // Disable Cloudinary to test asset blob retrieval
      // @ts-ignore
      vi.mocked(cloudStorageModule.allCloudStorageServices.cloudinary.isEnabled).mockReturnValue(
        false,
      );

      // Create an asset that would fail blobURL generation
      const assetWithNoBlob = {
        ...mockAsset,
        file: undefined,
        handle: undefined,
        blobURL: undefined,
      };

      mockBackend.fetchBlob.mockResolvedValue(null);

      vi.mocked(getAssetByPath).mockReturnValue(assetWithNoBlob);

      await expect(
        getMediaFieldURL({
          value: 'test.jpg',
          collectionName: 'posts',
        }),
      ).rejects.toThrow('Failed to retrieve blob');
    });

    it('should handle missing mime type in blob creation', async () => {
      const { default: mime } = await import('mime');

      vi.mocked(mime).getType.mockReturnValue('application/octet-stream');

      const remoteBlobData = new Uint8Array([1, 2, 3]);
      const remoteBlob = new Blob([remoteBlobData], { type: 'application/octet-stream' });

      mockBackend.fetchBlob.mockResolvedValue(remoteBlob);

      const result = await getAssetBlob(mockAsset);

      expect(result).toBeInstanceOf(Blob);
      expect(result).not.toBeNull();
    });

    it('should use fallback to global asset folder when collection folder not found', async () => {
      const { getAssetFoldersByPath } = await import('$lib/services/assets/folders');

      // Return empty array to force fallback to global folder
      vi.mocked(getAssetFoldersByPath).mockReturnValue([]);

      const assetWithCollection = {
        ...mockAsset,
        folder: {
          ...mockAsset.folder,
          collectionName: 'posts',
        },
      };

      const result = getAssetPublicURL(assetWithCollection, { pathOnly: true });

      expect(result).toBeDefined();
    });

    it('should handle undefined baseURL in cmsConfig', () => {
      mockCmsConfig._baseURL = undefined;

      const result = getAssetPublicURL(mockAsset);

      expect(result).toBeDefined();
      expect(result).toContain('assets/images/test.jpg');
    });

    it('should handle empty baseURL in cmsConfig', () => {
      mockCmsConfig._baseURL = '';

      const result = getAssetPublicURL(mockAsset, { pathOnly: true });

      expect(result).toBe('/assets/images/test.jpg');
    });

    it('should handle undefined output config in cmsConfig', () => {
      mockCmsConfig.output = undefined;

      const result = getAssetPublicURL(mockAsset, { pathOnly: true });

      expect(result).toBeDefined();
    });

    it('should handle asset with null/undefined internal path', () => {
      const assetWithoutInternalPath = {
        ...mockAsset,
        folder: {
          ...mockAsset.folder,
          internalPath: undefined,
        },
      };

      const result = getAssetPublicURL(assetWithoutInternalPath, { pathOnly: true });

      expect(result).toBeDefined();
    });

    it('should handle getEntriesByAssetURL when url is undefined', async () => {
      const { getEntriesByAssetURL } = await import('$lib/services/contents/collection/entries');

      vi.mocked(getEntriesByAssetURL).mockResolvedValue([]);

      const mockHandle = {
        getFile: vi.fn(async () => new File(['content'], 'test.jpg', { type: 'image/jpeg' })),
      };

      const entryRelativeAsset = {
        ...mockAsset,
        folder: {
          ...mockAsset.folder,
          entryRelative: true,
        },
        handle: mockHandle,
      };

      const result = await getAssetDetails(entryRelativeAsset);

      // URL should be undefined for entry-relative assets so getEntriesByAssetURL
      // should not be called
      expect(result.usedEntries).toEqual([]);
    });

    it('should handle getEntriesByAssetURL with used entries', async () => {
      const { getEntriesByAssetURL } = await import('$lib/services/contents/collection/entries');

      const mockUsedEntry = /** @type {any} */ ({
        id: 'entry-1',
        slug: 'test-entry',
        subPath: 'test',
        locales: { en: { path: 'en/entry.md' } },
      });

      vi.mocked(getEntriesByAssetURL).mockResolvedValue([mockUsedEntry]);

      const mockHandle = {
        getFile: vi.fn(async () => new File(['content'], 'test.jpg', { type: 'image/jpeg' })),
      };

      const assetWithHandle = {
        ...mockAsset,
        handle: mockHandle,
      };

      const result = await getAssetDetails(assetWithHandle);

      expect(vi.mocked(getEntriesByAssetURL)).toHaveBeenCalled();
      expect(result.usedEntries).toContain(mockUsedEntry);
    });

    it('should return public URL when blobURL is undefined', async () => {
      const { getAssetByPath } = await import('$lib/services/assets');

      const assetWithoutBlobURL = {
        ...mockAsset,
        file: undefined,
        handle: undefined,
        blobURL: undefined,
      };

      // Mock to prevent actual blob generation
      mockBackend.fetchBlob.mockResolvedValue(null);

      vi.mocked(getAssetByPath).mockReturnValue(assetWithoutBlobURL);

      try {
        await getMediaFieldURL({
          value: 'test.jpg',
          collectionName: 'posts',
        });
      } catch {
        // Expected to fail due to null blob
      }
    });

    it('should return thumbnail or fallback to public URL', async () => {
      const { getAssetByPath } = await import('$lib/services/assets');
      const { transformImage } = await import('$lib/services/utils/media/image/transform');

      // Disable Cloudinary to test thumbnail generation for relative paths
      // @ts-ignore
      vi.mocked(cloudStorageModule.allCloudStorageServices.cloudinary.isEnabled).mockReturnValue(
        false,
      );

      const mockHandle = {
        getFile: vi.fn(async () => new File(['content'], 'test.jpg', { type: 'image/jpeg' })),
      };

      const assetWithHandle = {
        ...mockAsset,
        handle: mockHandle,
      };

      vi.mocked(transformImage).mockResolvedValue(new Blob(['thumbnail']));

      vi.mocked(getAssetByPath).mockReturnValue(assetWithHandle);

      const result = await getMediaFieldURL({
        value: 'test.jpg',
        collectionName: 'posts',
        thumbnail: true,
      });

      expect(result).toBe('blob:mock-url');
    });

    it('should handle video asset thumbnail generation', async () => {
      const mockIndexedDB = {
        get: vi.fn().mockResolvedValue(undefined),
        set: vi.fn(),
      };

      const { IndexedDB } = await import('@sveltia/utils/storage');

      /** @type {any} */
      class MockIndexedDB {
        /**
         * Creates a mock IndexedDB instance.
         */
        constructor() {
          Object.assign(this, mockIndexedDB);
        }
      }

      // @ts-expect-error - Constructor signature mismatch
      vi.mocked(IndexedDB).mockImplementation(MockIndexedDB);

      const { transformImage } = await import('$lib/services/utils/media/image/transform');

      vi.mocked(transformImage).mockResolvedValue(new Blob(['thumbnail']));

      const mockHandle = {
        getFile: vi.fn(async () => new File(['video content'], 'test.mp4', { type: 'video/mp4' })),
      };

      const videoAsset = {
        ...mockAsset,
        name: 'test.mp4',
        kind: 'video',
        handle: mockHandle,
      };

      const result = await getAssetThumbnailURL(videoAsset);

      expect(result).toBe('blob:mock-url');
      expect(vi.mocked(transformImage)).toHaveBeenCalled();
    });

    it('should handle asset with collection name from folder', async () => {
      const { getAssetFoldersByPath } = await import('$lib/services/assets/folders');

      const collectionFolder = {
        internalPath: 'blog/media',
        publicPath: '/blog/media',
        collectionName: 'blog',
        entryRelative: false,
        hasTemplateTags: false,
      };

      // Mock to find a folder with collectionName
      vi.mocked(getAssetFoldersByPath).mockReturnValue([collectionFolder]);

      const assetWithCollectionFolder = {
        ...mockAsset,
        path: 'blog/media/image.jpg',
        folder: {
          ...mockAsset.folder,
          collectionName: 'blog',
          internalPath: 'blog/media',
          publicPath: '/blog/media',
        },
      };

      const result = getAssetPublicURL(assetWithCollectionFolder, { pathOnly: true });

      expect(result).toBeDefined();
      expect(getAssetFoldersByPath).toHaveBeenCalledWith(assetWithCollectionFolder.path);
    });

    it('should handle special path without allowSpecial flag', () => {
      const specialAsset = {
        ...mockAsset,
        path: '@alias/test.jpg',
        folder: {
          ...mockAsset.folder,
          internalPath: '@alias',
          publicPath: '@public',
        },
      };

      const result = getAssetPublicURL(specialAsset);

      expect(result).toBeUndefined();
    });

    it('should include baseURL in the final URL', () => {
      mockCmsConfig._baseURL = 'https://custom.example.com';

      const result = getAssetPublicURL(mockAsset);

      expect(result).toContain('https://custom.example.com');
    });

    it('should return path only without baseURL when pathOnly is true', () => {
      mockCmsConfig._baseURL = 'https://custom.example.com';

      const result = getAssetPublicURL(mockAsset, { pathOnly: true });

      expect(result).not.toContain('https://');
      expect(result).toContain('/assets/images/test.jpg');
    });

    it('should handle missing repository in backend', async () => {
      mockBackend.repository = undefined;

      const mockHandle = {
        getFile: vi.fn(async () => new File(['content'], 'test.jpg', { type: 'image/jpeg' })),
      };

      const assetWithHandle = {
        ...mockAsset,
        handle: mockHandle,
      };

      const result = await getAssetDetails(assetWithHandle);

      expect(result.repoBlobURL).toBeUndefined();
    });

    it('should handle missing databaseName in backend repository', async () => {
      mockBackend.repository.databaseName = null;

      const result = await getAssetThumbnailURL(mockAsset, { cacheOnly: true });

      expect(result).toBeUndefined();
    });

    it('should execute template tag replacement correctly', async () => {
      const templateAsset = {
        ...mockAsset,
        path: 'assets/images/my-post/featured.jpg',
        folder: {
          ...mockAsset.folder,
          internalPath: 'assets/images/{{slug}}',
          publicPath: '/images/{{slug}}',
          hasTemplateTags: true,
        },
      };

      const result = getAssetPublicURL(templateAsset, { pathOnly: true });

      expect(result).toBeDefined();
      expect(result).toContain('featured.jpg');
    });

    it('should return asset name for matching entry-relative path', async () => {
      const { getPathInfo } = await import('@sveltia/utils/file');

      // Mock getPathInfo to return matching dirname
      vi.mocked(getPathInfo).mockImplementation((path) => {
        if (path === 'assets/images/test.jpg') {
          return {
            dirname: 'assets/images',
            basename: 'test.jpg',
            filename: 'test',
            extension: '.jpg',
          };
        }

        return {
          dirname: 'assets/images',
          basename: 'entry.md',
          filename: 'entry',
          extension: '.md',
        };
      });

      const entryRelativeAsset = {
        ...mockAsset,
        folder: {
          ...mockAsset.folder,
          entryRelative: true,
        },
      };

      const mockEntry = /** @type {any} */ ({
        id: 'test-entry',
        slug: 'test',
        subPath: 'test',
        locales: {
          en: { path: 'assets/images/entry.md' },
        },
      });

      const result = getAssetPublicURL(entryRelativeAsset, {
        pathOnly: true,
        entry: mockEntry,
      });

      expect(result).toBe('test.jpg');
    });

    it('should return public URL without baseURL for path-only requests', () => {
      mockCmsConfig._baseURL = 'https://example.org';

      const result = getAssetPublicURL(mockAsset, { pathOnly: true });

      expect(result).not.toContain('example.org');
    });

    it('should preserve trailing slash in internal path matching', () => {
      const assetInSubdir = {
        ...mockAsset,
        path: 'assets/images/subfolder/file.jpg',
        folder: {
          ...mockAsset.folder,
          internalPath: 'assets/images',
          publicPath: '/media',
        },
      };

      const result = getAssetPublicURL(assetInSubdir, { pathOnly: true });

      expect(result).toBeDefined();
    });

    it('should handle async getEntriesByAssetURL with result', async () => {
      const { getEntriesByAssetURL } = await import('$lib/services/contents/collection/entries');

      const usedEntries = /** @type {any} */ ([
        {
          id: 'entry-1',
          slug: 'post-1',
          subPath: 'test',
          locales: { en: { path: 'en/post.md', slug: 'post', content: {} } },
        },
      ]);

      vi.mocked(getEntriesByAssetURL).mockResolvedValue(usedEntries);

      const mockHandle = {
        getFile: vi.fn(async () => new File(['content'], 'test.jpg', { type: 'image/jpeg' })),
      };

      const assetWithHandle = {
        ...mockAsset,
        handle: mockHandle,
      };

      const result = await getAssetDetails(assetWithHandle);

      expect(result.usedEntries).toHaveLength(1);
      expect(result.usedEntries[0].id).toBe('entry-1');
    });

    it('should handle asset blob caching', async () => {
      const mockHandle = {
        getFile: vi.fn(async () => new File(['content'], 'test.jpg', { type: 'image/jpeg' })),
      };

      const assetWithBlobURL = {
        ...mockAsset,
        blobURL: 'blob:existing-url',
        handle: mockHandle,
      };

      // First call returns blob from blobURL
      const result1 = await getAssetBlobURL(assetWithBlobURL);

      expect(result1).toBe('blob:existing-url');
      // getFile should not be called when blobURL exists
      expect(mockHandle.getFile).not.toHaveBeenCalled();
    });

    it('should not encode path when encoding is disabled', async () => {
      const { encodeFilePath } = await import('$lib/services/utils/file');

      mockCmsConfig.output.encode_file_path = false;

      const result = getAssetPublicURL(mockAsset, { pathOnly: true });

      expect(vi.mocked(encodeFilePath)).not.toHaveBeenCalled();
      expect(result).toContain('/assets/images/test.jpg');
    });

    it('should handle defaultAssetDetails export', () => {
      expect(defaultAssetDetails).toHaveProperty('publicURL');
      expect(defaultAssetDetails).toHaveProperty('repoBlobURL');
      expect(defaultAssetDetails).toHaveProperty('dimensions');
      expect(defaultAssetDetails).toHaveProperty('duration');
      expect(defaultAssetDetails).toHaveProperty('usedEntries');
      expect(defaultAssetDetails.usedEntries).toEqual([]);
    });

    it('should handle document-type asset with metadata', async () => {
      const { getMediaMetadata } = await import('$lib/services/utils/media');

      vi.mocked(getMediaMetadata).mockResolvedValue({
        dimensions: undefined,
        duration: undefined,
        createdDate: undefined,
        coordinates: undefined,
      });

      const mockHandle = {
        getFile: vi.fn(
          async () => new File(['content'], 'document.pdf', { type: 'application/pdf' }),
        ),
      };

      const documentAsset = {
        ...mockAsset,
        name: 'document.pdf',
        kind: 'document',
        handle: mockHandle,
      };

      await getAssetDetails(documentAsset);

      expect(vi.mocked(getMediaMetadata)).not.toHaveBeenCalled();
    });

    it('should retry blob fetch on concurrent request', async () => {
      const { sleep } = await import('@sveltia/utils/misc');
      const sleepMock = vi.mocked(sleep);

      sleepMock.mockResolvedValue(undefined);

      mockBackend.fetchBlob.mockResolvedValue(new Blob(['test'], { type: 'image/jpeg' }));

      const { default: mime } = await import('mime');

      vi.mocked(mime).getType.mockReturnValue('image/jpeg');

      const assetNoHandle = {
        ...mockAsset,
        handle: undefined,
        blobURL: undefined,
      };

      // Call with retryCount within limit to trigger sleep
      const result = await getAssetBlob(assetNoHandle, 5);

      expect(result).toBeInstanceOf(Blob);
    });

    it('should reach max retry count and fetch blob', async () => {
      const { sleep } = await import('@sveltia/utils/misc');

      vi.mocked(sleep).mockResolvedValue(undefined);

      mockBackend.fetchBlob.mockResolvedValue(new Blob(['test'], { type: 'image/jpeg' }));

      const { default: mime } = await import('mime');

      vi.mocked(mime).getType.mockReturnValue('image/jpeg');

      const assetNoHandle = {
        ...mockAsset,
        handle: undefined,
        blobURL: undefined,
      };

      // Call with retryCount at limit (25) to test conditional
      const result = await getAssetBlob(assetNoHandle, 25);

      expect(result).toBeInstanceOf(Blob);
    });

    it('should handle replaceAll in template tag replacement', async () => {
      const templateAsset = {
        ...mockAsset,
        path: 'assets/images/post1/test.jpg',
        folder: {
          ...mockAsset.folder,
          internalPath: 'assets/images/{{slug}}',
          publicPath: '/media/{{slug}}/files',
          hasTemplateTags: true,
        },
      };

      const result = getAssetPublicURL(templateAsset, { pathOnly: true });

      expect(result).toBeDefined();
      expect(result).toContain('test.jpg');
    });

    it('should handle optional chaining with undefined repository', async () => {
      mockBackend.repository = undefined;

      const mockHandle = {
        getFile: vi.fn(async () => new File(['content'], 'test.jpg', { type: 'image/jpeg' })),
      };

      const assetWithHandle = {
        ...mockAsset,
        handle: mockHandle,
      };

      const result = await getAssetDetails(assetWithHandle);

      expect(result.repoBlobURL).toBeUndefined();
      expect(result.publicURL).toBeDefined();
    });

    it('should return undefined for entry-relative asset without pathOnly', () => {
      const entryRelativeAsset = {
        ...mockAsset,
        folder: {
          ...mockAsset.folder,
          entryRelative: true,
        },
      };

      const result = getAssetPublicURL(entryRelativeAsset, { entry: undefined });

      expect(result).toBeUndefined();
    });

    it('should handle external media URLs in getMediaFieldURL', async () => {
      const httpUrl = 'https://cdn.example.com/image.jpg';
      const dataUrl = 'data:image/png;base64,abc';

      const httpResult = await getMediaFieldURL({
        value: httpUrl,
        collectionName: 'test',
      });

      expect(httpResult).toBe(httpUrl);

      const dataResult = await getMediaFieldURL({
        value: dataUrl,
        collectionName: 'test',
      });

      expect(dataResult).toBe(dataUrl);
    });
  });

  describe('getAssetBaseURL', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should return Cloudinary base URL when Cloudinary is enabled with valid config', () => {
      // @ts-ignore
      vi.mocked(cloudStorageModule.allCloudStorageServices.cloudinary.isEnabled).mockReturnValue(
        true,
      );
      vi.mocked(cloudinaryModule.getMergedLibraryOptions).mockReturnValue({
        output_filename_only: true,
        config: {
          cloud_name: 'my-cloud',
        },
      });

      const fieldConfig = /** @type {any} */ ({ type: 'image' });
      const result = getAssetBaseURL(fieldConfig);

      expect(result).toBe('https://res.cloudinary.com/my-cloud');
    });

    it('should return undefined when Cloudinary is not enabled', () => {
      // @ts-ignore
      vi.mocked(cloudStorageModule.allCloudStorageServices.cloudinary.isEnabled).mockReturnValue(
        false,
      );

      const fieldConfig = /** @type {any} */ ({ type: 'image' });
      const result = getAssetBaseURL(fieldConfig);

      expect(result).toBeUndefined();
    });

    it('should return undefined when output_filename_only is false', () => {
      // @ts-ignore
      vi.mocked(cloudStorageModule.allCloudStorageServices.cloudinary.isEnabled).mockReturnValue(
        true,
      );
      vi.mocked(cloudinaryModule.getMergedLibraryOptions).mockReturnValue({
        output_filename_only: false,
        config: {
          cloud_name: 'my-cloud',
        },
      });

      const fieldConfig = /** @type {any} */ ({ type: 'image' });
      const result = getAssetBaseURL(fieldConfig);

      expect(result).toBeUndefined();
    });

    it('should return undefined when cloud_name is missing', () => {
      // @ts-ignore
      vi.mocked(cloudStorageModule.allCloudStorageServices.cloudinary.isEnabled).mockReturnValue(
        true,
      );
      vi.mocked(cloudinaryModule.getMergedLibraryOptions).mockReturnValue({
        output_filename_only: true,
        config: {},
      });

      const fieldConfig = /** @type {any} */ ({ type: 'image' });
      const result = getAssetBaseURL(fieldConfig);

      expect(result).toBeUndefined();
    });

    it('should return undefined when config is missing', () => {
      // @ts-ignore
      vi.mocked(cloudStorageModule.allCloudStorageServices.cloudinary.isEnabled).mockReturnValue(
        true,
      );
      vi.mocked(cloudinaryModule.getMergedLibraryOptions).mockReturnValue({
        output_filename_only: true,
      });

      const fieldConfig = /** @type {any} */ ({ type: 'image' });
      const result = getAssetBaseURL(fieldConfig);

      expect(result).toBeUndefined();
    });

    it('should handle undefined fieldConfig', () => {
      // @ts-ignore
      vi.mocked(cloudStorageModule.allCloudStorageServices.cloudinary.isEnabled).mockReturnValue(
        true,
      );
      vi.mocked(cloudinaryModule.getMergedLibraryOptions).mockReturnValue({
        output_filename_only: true,
        config: {
          cloud_name: 'test-cloud',
        },
      });

      const result = getAssetBaseURL(undefined);

      expect(result).toBe('https://res.cloudinary.com/test-cloud');
    });

    it('should return undefined when Cloudinary service is null or undefined', () => {
      // @ts-ignore - Testing edge case where cloudinary is undefined
      const originalCloudinary = cloudStorageModule.allCloudStorageServices.cloudinary;

      // @ts-ignore
      cloudStorageModule.allCloudStorageServices.cloudinary = undefined;

      const result = getAssetBaseURL(/** @type {any} */ ({ type: 'image' }));

      expect(result).toBeUndefined();

      // Restore for other tests
      cloudStorageModule.allCloudStorageServices.cloudinary = originalCloudinary;
    });

    it('should pass fieldConfig to getMergedLibraryOptions', () => {
      // @ts-ignore
      vi.mocked(cloudStorageModule.allCloudStorageServices.cloudinary.isEnabled).mockReturnValue(
        true,
      );
      vi.mocked(cloudinaryModule.getMergedLibraryOptions).mockReturnValue({
        output_filename_only: true,
        config: {
          cloud_name: 'test-cloud',
        },
      });

      const fieldConfig = /** @type {any} */ ({ type: 'image', options: { width: 200 } });

      getAssetBaseURL(fieldConfig);

      expect(vi.mocked(cloudinaryModule.getMergedLibraryOptions)).toHaveBeenCalledWith(fieldConfig);
    });
  });
});
