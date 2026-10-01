import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { _resetAssetBlobCache } from '$lib/services/assets/info';
import {
  getAssetBaseURL,
  getMediaFieldSource,
  getMediaFieldURL,
} from '$lib/services/assets/media-field';
import * as cloudStorageModule from '$lib/services/integrations/media-libraries/cloud';
import * as cloudinaryModule from '$lib/services/integrations/media-libraries/cloud/cloudinary';

import { _resetAssetMetadataCache } from './details';

// Mock all dependencies
vi.mock('@sveltia/utils/file');
vi.mock('@sveltia/utils/misc');
vi.mock('@sveltia/utils/storage');
vi.mock('@sveltia/utils/string');
vi.mock('mime');

/** @type {{ current: any }} */
const mockBackendState = vi.hoisted(() => ({ current: undefined }));
/** @type {{ current: any }} */
const mockCmsConfigState = vi.hoisted(() => ({ current: undefined }));
/** @type {{ current: any }} */
const mockGlobalAssetFolder = vi.hoisted(() => ({ current: undefined }));
/** @type {{ current: any[] }} */
const mockAllAssets = vi.hoisted(() => ({ current: [] }));

vi.mock('@sveltia/i18n', () => ({
  _: vi.fn((key) => key),
  addMessages: vi.fn(),
  locale: { current: 'en', set: vi.fn() },
  dictionary: {},
}));
vi.mock('$lib/services/assets', () => ({
  getAssetByPath: vi.fn(),
  isRelativePath: vi.fn((path) => !/^[/@]/.test(path)),
}));

vi.mock('$lib/services/assets/state', () => ({
  focusedAsset: { current: undefined },
  allAssets: mockAllAssets,
}));
vi.mock('$lib/services/backends', () => ({
  backend: mockBackendState,
}));
vi.mock('$lib/services/config', () => ({
  cmsConfig: mockCmsConfigState,
}));
vi.mock('$lib/services/assets/folders', () => ({
  getAssetFoldersByPath: vi.fn(),
  globalAssetFolder: mockGlobalAssetFolder,
  selectedAssetFolder: { current: undefined },
}));
vi.mock('$lib/services/assets/references');
vi.mock('$lib/services/utils/file');
vi.mock('$lib/services/utils/media');
vi.mock('$lib/services/utils/media/image/svg');
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

describe('assets/media-field', () => {
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
    _resetAssetBlobCache();
    _resetAssetMetadataCache();

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
    mockBackendState.current = mockBackend;
    mockCmsConfigState.current = mockCmsConfig;
    mockGlobalAssetFolder.current = mockAsset.folder;
    mockAllAssets.current = [];

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

  describe('getMediaFieldSource', () => {
    it('should return undefined for empty value', () => {
      expect(getMediaFieldSource({ value: '', collectionName: 'posts' })).toBeUndefined();
    });

    it('should return an external URL as-is', () => {
      expect(
        getMediaFieldSource({ value: 'https://example.com/image.jpg', collectionName: 'posts' }),
      ).toEqual({ url: 'https://example.com/image.jpg' });
    });

    it('should return the asset the path points to', async () => {
      const { getAssetByPath } = await import('$lib/services/assets');

      vi.mocked(getAssetByPath).mockReturnValue(mockAsset);

      const entry = /** @type {any} */ ({ id: 'post' });

      expect(
        getMediaFieldSource({
          value: '/uploads/test.jpg',
          entry,
          collectionName: 'posts',
          fileName: 'about',
          componentName: 'figure',
          typedKeyPath: 'hero.image',
        }),
      ).toEqual({ asset: mockAsset });

      expect(getAssetByPath).toHaveBeenCalledWith({
        value: '/uploads/test.jpg',
        entry,
        collectionName: 'posts',
        fileName: 'about',
        componentName: 'figure',
        typedKeyPath: 'hero.image',
      });

      vi.mocked(getAssetByPath).mockReturnValue(undefined);

      expect(
        getMediaFieldSource({ value: '/uploads/missing.jpg', collectionName: 'posts' }),
      ).toBeUndefined();
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

    it('should pass componentName and typedKeyPath to getAssetByPath when provided', async () => {
      const { getAssetByPath } = await import('$lib/services/assets');

      // Ensure Cloudinary is disabled so the relative path reaches getAssetByPath
      // @ts-ignore
      vi.mocked(cloudStorageModule.allCloudStorageServices.cloudinary.isEnabled).mockReturnValue(
        false,
      );

      const assetWithBlobURL = {
        ...mockAsset,
        blobURL: 'blob:typed-key-url',
      };

      vi.mocked(getAssetByPath).mockReturnValue(assetWithBlobURL);

      const result = await getMediaFieldURL({
        value: 'hero-image.jpg',
        collectionName: 'posts',
        componentName: 'custom-editor',
        typedKeyPath: 'hero',
      });

      expect(result).toBe('blob:typed-key-url');
      expect(vi.mocked(getAssetByPath)).toHaveBeenCalledWith(
        expect.objectContaining({
          value: 'hero-image.jpg',
          collectionName: 'posts',
          componentName: 'custom-editor',
          typedKeyPath: 'hero',
        }),
      );
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
      // @ts-ignore
      expect(cloudStorageModule.allCloudStorageServices.cloudinary.isEnabled).toHaveBeenCalledWith(
        fieldConfig,
      );
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
