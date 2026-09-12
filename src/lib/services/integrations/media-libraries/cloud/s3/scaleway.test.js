import { beforeEach, describe, expect, it, vi } from 'vitest';

import { cmsConfig } from '$lib/services/config';

import scalewayObjectStorageService, {
  deleteFiles,
  getLibraryOptions,
  isEnabled,
  list,
  rename,
  replace,
  search,
  upload,
} from './scaleway';

// Mock dependencies
vi.mock('$lib/services/config', () => ({
  cmsConfig: { current: undefined },
}));

vi.mock('./index', () => ({
  listS3Objects: vi.fn(),
  searchS3Objects: vi.fn(),
  uploadToS3: vi.fn(),
}));

vi.mock('./core', async (importOriginal) => {
  const actual = /** @type {object} */ (await importOriginal());

  return {
    ...actual,
    listS3Objects: vi.fn(),
    searchS3Objects: vi.fn(),
    uploadToS3: vi.fn(),
    deleteS3Objects: vi.fn(),
    renameS3Object: vi.fn(),
    replaceS3Object: vi.fn(),
  };
});

describe('integrations/media-libraries/cloud/s3/scaleway-object-storage', () => {
  const mockAccessKeyId = 'SCWXXXXXXXXXXXXXXXXXX';
  const mockBucket = 'my-bucket';
  const mockRegion = 'fr-par';

  beforeEach(() => {
    vi.clearAllMocks();

    cmsConfig.current = /** @type {any} */ ({
      media_libraries: {
        scaleway_object_storage: {
          access_key_id: mockAccessKeyId,
          bucket: mockBucket,
          region: mockRegion,
        },
      },
    });
  });

  describe('service configuration', () => {
    it('should have correct service configuration', () => {
      expect(scalewayObjectStorageService.serviceType).toBe('cloud_storage');
      expect(scalewayObjectStorageService.serviceId).toBe('scaleway_object_storage');
      expect(scalewayObjectStorageService.serviceLabel).toBe('Scaleway Object Storage');
      expect(scalewayObjectStorageService.serviceURL).toBe(
        'https://www.scaleway.com/en/object-storage/',
      );
      expect(scalewayObjectStorageService.showServiceLink).toBe(true);
      expect(scalewayObjectStorageService.hotlinking).toBe(true);
      expect(scalewayObjectStorageService.authType).toBe('api_key');
      expect(scalewayObjectStorageService.developerURL).toBe(
        'https://www.scaleway.com/en/docs/object-storage/',
      );
      expect(scalewayObjectStorageService.apiKeyURL).toBe(
        'https://console.scaleway.com/iam/api-keys',
      );
      expect(scalewayObjectStorageService.apiKeyPattern).toBeInstanceOf(RegExp);
      // eslint-disable-next-line import-x/no-named-as-default-member
      expect(scalewayObjectStorageService.isEnabled).toBeDefined();
    });

    it('should validate secret access key format', () => {
      const { apiKeyPattern } = scalewayObjectStorageService;

      if (!apiKeyPattern) {
        throw new Error('apiKeyPattern is not defined');
      }

      // Valid secret access keys (UUID v4 format)
      expect(apiKeyPattern.test('12345678-1234-4234-a234-123456789abc')).toBe(true);
      expect(apiKeyPattern.test('00000000-0000-4000-8000-000000000000')).toBe(true);
      expect(apiKeyPattern.test('ffffffff-ffff-4fff-bfff-ffffffffffff')).toBe(true);

      // Invalid secret access keys
      expect(apiKeyPattern.test('abcdef1234')).toBe(false); // too short
      expect(apiKeyPattern.test('12345678-1234-3234-a234-123456789abc')).toBe(false); // wrong version
      expect(apiKeyPattern.test('12345678-1234-4234-c234-123456789abc')).toBe(false); // wrong variant
      expect(apiKeyPattern.test('12345678-1234-4234-a234-123456789abcZZ')).toBe(false); // too long
      expect(apiKeyPattern.test('')).toBe(false);
    });
  });

  describe('isEnabled', () => {
    it('should return true when valid config is present', () => {
      expect(isEnabled()).toBe(true);
    });

    it('should return false when config is missing', () => {
      cmsConfig.current = /** @type {any} */ ({});

      expect(isEnabled()).toBe(false);
    });

    it('should return false when credentials are missing', () => {
      cmsConfig.current = /** @type {any} */ ({
        media_libraries: {
          scaleway_object_storage: {},
        },
      });

      expect(isEnabled()).toBe(false);
    });

    it('should return true when field-level config is present', () => {
      cmsConfig.current = /** @type {any} */ ({});

      expect(
        isEnabled(
          /** @type {any} */ ({
            widget: 'file',
            media_libraries: {
              scaleway_object_storage: {
                access_key_id: mockAccessKeyId,
                bucket: mockBucket,
                region: mockRegion,
              },
            },
          }),
        ),
      ).toBe(true);
    });

    it('should return false when field-level config has missing credentials', () => {
      cmsConfig.current = /** @type {any} */ ({});

      expect(
        isEnabled(
          /** @type {any} */ ({
            widget: 'file',
            media_libraries: {
              scaleway_object_storage: {},
            },
          }),
        ),
      ).toBe(false);
    });
  });

  describe('getLibraryOptions', () => {
    it('should return Scaleway Object Storage configuration', () => {
      const options = getLibraryOptions();

      expect(options).toEqual({
        access_key_id: mockAccessKeyId,
        bucket: mockBucket,
        region: mockRegion,
      });
    });

    it('should return config from legacy media_library format', () => {
      cmsConfig.current = /** @type {any} */ ({
        media_library: {
          name: 'scaleway_object_storage',
          access_key_id: mockAccessKeyId,
          bucket: mockBucket,
          region: mockRegion,
        },
      });

      const options = getLibraryOptions();

      expect(options).toMatchObject({
        name: 'scaleway_object_storage',
        access_key_id: mockAccessKeyId,
        bucket: mockBucket,
        region: mockRegion,
      });
    });

    it('should return undefined when neither media_libraries nor matching media_library exists', () => {
      cmsConfig.current = /** @type {any} */ ({
        media_library: { name: 'other_service' },
      });

      expect(getLibraryOptions()).toBeUndefined();
    });
  });

  describe('list/search/upload config building', () => {
    const mockOptions = { kind: undefined, apiKey: 'secret', fieldConfig: undefined };

    beforeEach(async () => {
      const core = await import('./core');

      vi.mocked(core.listS3Objects).mockResolvedValue([]);
      vi.mocked(core.searchS3Objects).mockResolvedValue([]);
      vi.mocked(core.uploadToS3).mockResolvedValue([]);
    });

    it('list should use path-style region endpoint and derive virtual-hosted public_url', async () => {
      const core = await import('./core');

      await list(mockOptions);

      expect(core.listS3Objects).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: `https://s3.${mockRegion}.scw.cloud`,
          public_url: `https://${mockBucket}.s3.${mockRegion}.scw.cloud`,
        }),
        mockOptions,
      );
    });

    it('list should use explicit public_url when set in config', async () => {
      const core = await import('./core');

      cmsConfig.current = /** @type {any} */ ({
        media_libraries: {
          scaleway_object_storage: {
            access_key_id: mockAccessKeyId,
            bucket: mockBucket,
            region: mockRegion,
            public_url: 'https://my-cdn.example.com',
          },
        },
      });

      await list(mockOptions);

      expect(core.listS3Objects).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: `https://s3.${mockRegion}.scw.cloud`,
          public_url: 'https://my-cdn.example.com',
        }),
        mockOptions,
      );
    });

    it('search should use path-style region endpoint and derive virtual-hosted public_url', async () => {
      const core = await import('./core');

      await search('photo', mockOptions);

      expect(core.searchS3Objects).toHaveBeenCalledWith(
        'photo',
        expect.objectContaining({
          endpoint: `https://s3.${mockRegion}.scw.cloud`,
          public_url: `https://${mockBucket}.s3.${mockRegion}.scw.cloud`,
        }),
        mockOptions,
      );
    });

    it('upload should use path-style region endpoint and derive virtual-hosted public_url', async () => {
      const core = await import('./core');

      await upload([], mockOptions);

      expect(core.uploadToS3).toHaveBeenCalledWith(
        [],
        expect.objectContaining({
          endpoint: `https://s3.${mockRegion}.scw.cloud`,
          public_url: `https://${mockBucket}.s3.${mockRegion}.scw.cloud`,
        }),
        mockOptions,
      );
    });

    it('list should reject when config is not available', async () => {
      cmsConfig.current = /** @type {any} */ ({});

      await expect(
        list({ kind: undefined, apiKey: 'secret', fieldConfig: undefined }),
      ).rejects.toThrow('Scaleway Object Storage configuration is not available');
    });

    it('search should reject when config is not available', async () => {
      cmsConfig.current = /** @type {any} */ ({});

      await expect(
        search('photo', { kind: undefined, apiKey: 'secret', fieldConfig: undefined }),
      ).rejects.toThrow('Scaleway Object Storage configuration is not available');
    });

    it('upload should reject when config is not available', async () => {
      cmsConfig.current = /** @type {any} */ ({});

      await expect(upload([], { apiKey: 'secret', fieldConfig: undefined })).rejects.toThrow(
        'Scaleway Object Storage configuration is not available',
      );
    });
  });

  describe('delete, rename and replace', () => {
    /** @type {any} */
    const asset = { id: 'photo.jpg', fileName: 'photo.jpg' };
    const options = { apiKey: 'secret', fieldConfig: undefined };

    it('should expose the management functions on the service', () => {
      expect(scalewayObjectStorageService).toMatchObject({ delete: deleteFiles, rename, replace });
    });

    it('should call deleteS3Objects with the resolved config', async () => {
      const core = await import('./core');

      await deleteFiles([asset], options);

      expect(core.deleteS3Objects).toHaveBeenCalledWith(
        [asset],
        expect.objectContaining({ bucket: mockBucket }),
        options,
      );
    });

    it('should call renameS3Object with the resolved config', async () => {
      const core = await import('./core');

      await rename(asset, 'renamed.jpg', options);

      expect(core.renameS3Object).toHaveBeenCalledWith(
        asset,
        'renamed.jpg',
        expect.objectContaining({ bucket: mockBucket }),
        options,
      );
    });

    it('should call replaceS3Object with the resolved config', async () => {
      const core = await import('./core');
      const file = new File(['content'], 'photo.jpg', { type: 'image/jpeg' });

      await replace(asset, file, options);

      expect(core.replaceS3Object).toHaveBeenCalledWith(
        asset,
        file,
        expect.objectContaining({ bucket: mockBucket }),
        options,
      );
    });

    it('should reject when config is not available', async () => {
      cmsConfig.current = /** @type {any} */ ({});

      const file = new File(['content'], 'photo.jpg', { type: 'image/jpeg' });

      await expect(deleteFiles([asset], options)).rejects.toThrow(
        'Scaleway Object Storage configuration is not available',
      );
      await expect(rename(asset, 'renamed.jpg', options)).rejects.toThrow(
        'Scaleway Object Storage configuration is not available',
      );
      await expect(replace(asset, file, options)).rejects.toThrow(
        'Scaleway Object Storage configuration is not available',
      );
    });
  });
});
