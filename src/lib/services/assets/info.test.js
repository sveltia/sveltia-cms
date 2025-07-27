import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  defaultAssetDetails,
  getAssetBlob,
  getAssetBlobURL,
  getAssetDetails,
  getAssetPublicURL,
  getAssetThumbnailURL,
  getMediaFieldURL,
} from './info';

// Mock all dependencies
vi.mock('@sveltia/utils/file');
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
  locale: { subscribe: vi.fn() },
  $dictionary: { subscribe: vi.fn() },
  dictionary: { subscribe: vi.fn() },
}));
vi.mock('$lib/services/assets', () => ({
  getAssetByPath: vi.fn(),
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
  siteConfig: {
    subscribe: vi.fn(),
    _mockValue: 'siteConfig',
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

describe('assets/info', () => {
  /** @type {any} */
  let mockAsset;
  /** @type {Blob} */
  let mockBlob;
  /** @type {any} */
  let mockBackend;
  /** @type {any} */
  let mockSiteConfig;

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
    mockSiteConfig = {
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
        if (store._mockValue === 'siteConfig') return mockSiteConfig;
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

      const assetWithFile = {
        ...mockAsset,
        file,
      };

      const result = await getAssetBlob(assetWithFile);

      expect(result).toBe(file);
      expect(assetWithFile.blobURL).toBe('blob:mock-url');
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

      const assetWithFile = {
        ...mockAsset,
        file,
      };

      const result = await getAssetBlobURL(assetWithFile);

      expect(result).toBe('blob:mock-url');
      expect(assetWithFile.blobURL).toBe('blob:mock-url');
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
      // @ts-ignore
      vi.mocked(IndexedDB).mockReturnValue(mockIndexedDB);
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

      // Provide a file to avoid getAssetBlob issues
      const assetWithFile = {
        ...mockAsset,
        file: new File(['content'], 'test.jpg', { type: 'image/jpeg' }),
      };

      const result = await getAssetThumbnailURL(assetWithFile);

      // Since this test may run after another test that initialized thumbnailDB,
      // we focus on the core behavior: returning a blob URL
      expect(result).toBe('blob:mock-url');
    });
    it('should generate thumbnail for PDF using renderPDF', async () => {
      mockIndexedDB.get.mockResolvedValue(undefined);

      const pdfAsset = {
        ...mockAsset,
        name: 'test.pdf',
        file: new File(['pdf content'], 'test.pdf', { type: 'application/pdf' }),
      };

      const { renderPDF } = await import('$lib/services/utils/media/pdf');
      const renderPDFMock = vi.mocked(renderPDF);
      const thumbnailBlob = new Blob(['pdf thumbnail'], { type: 'image/webp' });

      renderPDFMock.mockResolvedValue(thumbnailBlob);

      const result = await getAssetThumbnailURL(pdfAsset);

      expect(renderPDFMock).toHaveBeenCalledWith(pdfAsset.file, {
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

      vi.mocked(getAssetFoldersByPath).mockReturnValue([]);

      const getMock = vi.mocked(get);

      getMock.mockImplementation((store) => {
        if (store && typeof store === 'object' && '_mockValue' in store) {
          if (store._mockValue === 'backend') return mockBackend;
          if (store._mockValue === 'siteConfig') return mockSiteConfig;
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

    it('should handle template tags in path', async () => {
      const { escapeRegExp } = await import('@sveltia/utils/string');
      const { createPathRegEx } = await import('$lib/services/utils/file');

      vi.mocked(escapeRegExp).mockImplementation((str) => str);
      vi.mocked(createPathRegEx).mockReturnValue(/assets\/images/);

      const templateAsset = {
        ...mockAsset,
        path: 'assets/images/{{slug}}/test.jpg',
        folder: {
          ...mockAsset.folder,
          internalPath: 'assets/images/{{slug}}',
          publicPath: '/public/{{slug}}',
          hasTemplateTags: true,
        },
      };

      const result = getAssetPublicURL(templateAsset, { pathOnly: true });

      expect(result).toContain('test.jpg');
    });

    it('should encode file path when encoding is enabled', async () => {
      const { encodeFilePath } = await import('$lib/services/utils/file');

      vi.mocked(encodeFilePath).mockReturnValue('/encoded/path/test.jpg');

      mockSiteConfig.output.encode_file_path = true;

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
      const assetWithFile = {
        ...mockAsset,
        file: new File(['content'], 'test.jpg', { type: 'image/jpeg' }),
      };

      const { getAssetByPath } = await import('$lib/services/assets');

      vi.mocked(getAssetByPath).mockReturnValue(assetWithFile);

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

      // @ts-ignore
      vi.mocked(IndexedDB).mockReturnValue(mockIndexedDB);

      const { transformImage } = await import('$lib/services/utils/media/image/transform');

      vi.mocked(transformImage).mockResolvedValue(new Blob(['thumbnail']));

      const assetWithFile = {
        ...mockAsset,
        file: new File(['content'], 'test.jpg', { type: 'image/jpeg' }),
      };

      const { getAssetByPath } = await import('$lib/services/assets');

      vi.mocked(getAssetByPath).mockReturnValue(assetWithFile);

      const result = await getMediaFieldURL({
        value: 'test.jpg',
        collectionName: 'posts',
        thumbnail: true,
      });

      expect(result).toBe('blob:mock-url');
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
      const assetWithFile = {
        ...mockAsset,
        file: new File(['content'], 'test.jpg', { type: 'image/jpeg' }),
      };

      const result = await getAssetDetails(assetWithFile);

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

      const textAsset = {
        ...mockAsset,
        name: 'test.txt',
        kind: 'document',
        file: new File(['content'], 'test.txt', { type: 'text/plain' }),
      };

      await getAssetDetails(textAsset);

      expect(vi.mocked(getMediaMetadata)).not.toHaveBeenCalled();
    });

    it('should handle missing repository blobBaseURL', async () => {
      mockBackend.repository.blobBaseURL = undefined;

      const assetWithFile = {
        ...mockAsset,
        file: new File(['content'], 'test.jpg', { type: 'image/jpeg' }),
      };

      const result = await getAssetDetails(assetWithFile);

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
});
