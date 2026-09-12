import { beforeEach, describe, expect, it, vi } from 'vitest';

import { cmsConfig } from '$lib/services/config';

import awsS3Service, {
  deleteFiles,
  getLibraryOptions,
  isAssetURL,
  isEnabled,
  list,
  rename,
  replace,
  search,
  upload,
} from './aws-s3';

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
    isS3ObjectUrl: vi.fn(() => true),
  };
});

describe('integrations/media-libraries/cloud/s3/aws-s3', () => {
  const mockAccessKeyId = 'AKIAIOSFODNN7EXAMPLE';
  const mockBucket = 'my-bucket';
  const mockRegion = 'us-east-1';

  beforeEach(() => {
    vi.clearAllMocks();

    cmsConfig.current = /** @type {any} */ ({
      media_libraries: {
        aws_s3: {
          access_key_id: mockAccessKeyId,
          bucket: mockBucket,
          region: mockRegion,
        },
      },
    });
  });

  describe('service configuration', () => {
    it('should have correct service configuration', () => {
      expect(awsS3Service.serviceType).toBe('cloud_storage');
      expect(awsS3Service.serviceId).toBe('aws_s3');
      expect(awsS3Service.serviceLabel).toBe('Amazon S3');
      expect(awsS3Service.serviceURL).toBe('https://aws.amazon.com/s3/');
      expect(awsS3Service.showServiceLink).toBe(true);
      expect(awsS3Service.hotlinking).toBe(true);
      expect(awsS3Service.authType).toBe('api_key');
      expect(awsS3Service.developerURL).toBe('https://docs.aws.amazon.com/s3/');
      expect(awsS3Service.apiKeyURL).toBe(
        'https://console.aws.amazon.com/iam/home#/security_credentials',
      );
      expect(awsS3Service.apiKeyPattern).toBeInstanceOf(RegExp);
      // eslint-disable-next-line import-x/no-named-as-default-member
      expect(awsS3Service.isEnabled).toBeDefined();
    });

    it('should validate secret access key format', () => {
      const { apiKeyPattern } = awsS3Service;

      if (!apiKeyPattern) {
        throw new Error('apiKeyPattern is not defined');
      }

      // Valid secret access keys (40 base64-like chars)
      expect(apiKeyPattern.test('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY')).toBe(true);
      expect(apiKeyPattern.test('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKL==')).toBe(true);

      // Invalid secret access keys
      expect(apiKeyPattern.test('AKIAIOSFODNN7EXAMPLE')).toBe(false); // Too short
      expect(apiKeyPattern.test('short')).toBe(false); // Too short
      expect(apiKeyPattern.test('AKIA-IOSFODNN7EXAMPLE')).toBe(false); // Invalid char
      expect(apiKeyPattern.test('ASIAXXXXXXXXXXX')).toBe(false); // Too short
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
          aws_s3: {
            config: {},
          },
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
              aws_s3: {
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
              aws_s3: {},
            },
          }),
        ),
      ).toBe(false);
    });
  });

  describe('getLibraryOptions', () => {
    it('should return S3 configuration', () => {
      const options = getLibraryOptions();

      expect(options).toEqual({
        access_key_id: mockAccessKeyId,
        bucket: mockBucket,
        region: mockRegion,
      });
    });
  });

  describe('list', () => {
    beforeEach(async () => {
      const core = await import('./core');

      vi.mocked(core.listS3Objects).mockResolvedValue([]);
    });

    it('should call listS3Objects with S3 config', async () => {
      const core = await import('./core');

      const options = {
        kind: /** @type {undefined} */ (undefined),
        apiKey: 'secret',
        fieldConfig: undefined,
      };

      await list(options);

      expect(core.listS3Objects).toHaveBeenCalledWith(
        expect.objectContaining({
          access_key_id: mockAccessKeyId,
          bucket: mockBucket,
          region: mockRegion,
        }),
        options,
      );
    });

    it('should use fieldConfig when provided', async () => {
      const core = await import('./core');

      const fieldConfig = /** @type {any} */ ({
        media_library: {
          name: 'aws_s3',

          access_key_id: 'field-key',
          bucket: 'field-bucket',
          region: 'eu-west-1',
        },
      });

      const options = { kind: /** @type {undefined} */ (undefined), apiKey: 'secret', fieldConfig };

      await list(options);

      expect(core.listS3Objects).toHaveBeenCalledWith(
        expect.objectContaining({ access_key_id: 'field-key' }),
        options,
      );
    });

    it('should reject when config is not available', async () => {
      cmsConfig.current = /** @type {any} */ ({});

      await expect(
        list({
          kind: /** @type {undefined} */ (undefined),
          apiKey: 'secret',
          fieldConfig: undefined,
        }),
      ).rejects.toThrow('Amazon S3 configuration is not available');
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      const core = await import('./core');

      vi.mocked(core.searchS3Objects).mockResolvedValue([]);
    });

    it('should call searchS3Objects with S3 config', async () => {
      const core = await import('./core');

      const options = {
        kind: /** @type {undefined} */ (undefined),
        apiKey: 'secret',
        fieldConfig: undefined,
      };

      await search('photo', options);

      expect(core.searchS3Objects).toHaveBeenCalledWith(
        'photo',
        expect.objectContaining({ access_key_id: mockAccessKeyId }),
        options,
      );
    });

    it('should reject when config is not available', async () => {
      cmsConfig.current = /** @type {any} */ ({});

      await expect(
        search('photo', {
          kind: /** @type {undefined} */ (undefined),
          apiKey: 'secret',
          fieldConfig: undefined,
        }),
      ).rejects.toThrow('Amazon S3 configuration is not available');
    });
  });

  describe('upload', () => {
    beforeEach(async () => {
      const core = await import('./core');

      vi.mocked(core.uploadToS3).mockResolvedValue([]);
    });

    it('should call uploadToS3 with S3 config', async () => {
      const core = await import('./core');
      const mockFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
      const options = { apiKey: 'secret', fieldConfig: undefined };

      await upload([mockFile], options);

      expect(core.uploadToS3).toHaveBeenCalledWith(
        [mockFile],
        expect.objectContaining({ access_key_id: mockAccessKeyId }),
        options,
      );
    });

    it('should reject when config is not available', async () => {
      cmsConfig.current = /** @type {any} */ ({});

      const mockFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });

      await expect(
        upload([mockFile], { apiKey: 'secret', fieldConfig: undefined }),
      ).rejects.toThrow('Amazon S3 configuration is not available');
    });
  });

  describe('delete, rename and replace', () => {
    /** @type {any} */
    const asset = { id: 'photo.jpg', fileName: 'photo.jpg' };
    const options = { apiKey: 'secret', fieldConfig: undefined };

    it('should expose the management functions on the service', () => {
      expect(awsS3Service).toMatchObject({ delete: deleteFiles, rename, replace });
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
        'Amazon S3 configuration is not available',
      );
      await expect(rename(asset, 'renamed.jpg', options)).rejects.toThrow(
        'Amazon S3 configuration is not available',
      );
      await expect(replace(asset, file, options)).rejects.toThrow(
        'Amazon S3 configuration is not available',
      );
    });
  });

  describe('isAssetURL', () => {
    it('should check the URL against the resolved config', async () => {
      const core = await import('./core');

      expect(awsS3Service).toMatchObject({ isAssetURL });
      expect(isAssetURL('https://example.com/a.jpg')).toBe(true);
      expect(core.isS3ObjectUrl).toHaveBeenCalledWith(
        expect.objectContaining({ bucket: mockBucket }),
        'https://example.com/a.jpg',
      );
    });

    it('should be false when the service is not configured', () => {
      cmsConfig.current = /** @type {any} */ ({});
      expect(isAssetURL('https://example.com/a.jpg')).toBe(false);
    });
  });
});
