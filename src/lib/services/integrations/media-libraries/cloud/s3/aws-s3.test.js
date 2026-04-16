import { get } from 'svelte/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import awsS3Service, { getLibraryOptions, isEnabled, list, search, upload } from './aws-s3';

// Mock dependencies
vi.mock('svelte/store', () => ({
  get: vi.fn(),
}));

vi.mock('$lib/services/config', () => ({
  cmsConfig: { subscribe: vi.fn() },
}));

vi.mock('./index', () => ({
  listS3Objects: vi.fn(),
  searchS3Objects: vi.fn(),
  uploadToS3: vi.fn(),
}));

vi.mock('./core', () => ({
  listS3Objects: vi.fn(),
  searchS3Objects: vi.fn(),
  uploadToS3: vi.fn(),
}));

describe('integrations/media-libraries/cloud/s3/aws-s3', () => {
  const mockAccessKeyId = 'AKIAIOSFODNN7EXAMPLE';
  const mockBucket = 'my-bucket';
  const mockRegion = 'us-east-1';

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(get).mockReturnValue({
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
      vi.mocked(get).mockReturnValue({});

      expect(isEnabled()).toBe(false);
    });

    it('should return false when credentials are missing', () => {
      vi.mocked(get).mockReturnValue({
        media_libraries: {
          aws_s3: {
            config: {},
          },
        },
      });

      expect(isEnabled()).toBe(false);
    });

    it('should return true when field-level config is present', () => {
      vi.mocked(get).mockReturnValue({});

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
      vi.mocked(get).mockReturnValue({});

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
      vi.mocked(get).mockReturnValue({});

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
      vi.mocked(get).mockReturnValue({});

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
      vi.mocked(get).mockReturnValue({});

      const mockFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });

      await expect(
        upload([mockFile], { apiKey: 'secret', fieldConfig: undefined }),
      ).rejects.toThrow('Amazon S3 configuration is not available');
    });
  });
});
