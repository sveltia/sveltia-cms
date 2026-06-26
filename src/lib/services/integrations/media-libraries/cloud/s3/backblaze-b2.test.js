import { get } from 'svelte/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import backblazeB2Service, {
  getLibraryOptions,
  isEnabled,
  list,
  search,
  upload,
} from './backblaze-b2';

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

vi.mock('./core', async (importOriginal) => {
  const actual = /** @type {object} */ (await importOriginal());

  return {
    ...actual,
    listS3Objects: vi.fn(),
    searchS3Objects: vi.fn(),
    uploadToS3: vi.fn(),
  };
});

describe('integrations/media-libraries/cloud/s3/backblaze-b2', () => {
  const mockAccessKeyId = '0014abcdef01234567890123456';
  const mockBucket = 'my-bucket';
  const mockRegion = 'us-west-004';

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(get).mockReturnValue({
      media_libraries: {
        backblaze_b2: {
          access_key_id: mockAccessKeyId,
          bucket: mockBucket,
          region: mockRegion,
        },
      },
    });
  });

  describe('service configuration', () => {
    it('should have correct service configuration', () => {
      expect(backblazeB2Service.serviceType).toBe('cloud_storage');
      expect(backblazeB2Service.serviceId).toBe('backblaze_b2');
      expect(backblazeB2Service.serviceLabel).toBe('Backblaze B2');
      expect(backblazeB2Service.serviceURL).toBe('https://www.backblaze.com/cloud-storage');
      expect(backblazeB2Service.showServiceLink).toBe(true);
      expect(backblazeB2Service.hotlinking).toBe(true);
      expect(backblazeB2Service.authType).toBe('api_key');
      expect(backblazeB2Service.developerURL).toBe(
        'https://www.backblaze.com/docs/cloud-storage-s3-compatible-api',
      );
      expect(backblazeB2Service.apiKeyURL).toBe('https://secure.backblaze.com/app_keys.htm');
      expect(backblazeB2Service.apiKeyPattern).toBeInstanceOf(RegExp);
      // eslint-disable-next-line import-x/no-named-as-default-member
      expect(backblazeB2Service.isEnabled).toBeDefined();
    });

    it('should validate application key format', () => {
      const { apiKeyPattern } = backblazeB2Service;

      if (!apiKeyPattern) {
        throw new Error('apiKeyPattern is not defined');
      }

      // Valid application keys (30+ alphanumeric/base64 chars)
      expect(apiKeyPattern.test('K001abcdefghijklmnopqrstuvwxyz01')).toBe(true);
      expect(apiKeyPattern.test('abcdefghijklmnopqrstuvwxyz123456')).toBe(true);
      expect(apiKeyPattern.test('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY')).toBe(true);

      // Invalid application keys
      expect(apiKeyPattern.test('tooshort')).toBe(false); // too short
      expect(apiKeyPattern.test('abcdef-1234567890abcdef1234567890')).toBe(false); // invalid char
      expect(apiKeyPattern.test('')).toBe(false);
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
          backblaze_b2: {},
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
              backblaze_b2: {
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
              backblaze_b2: {},
            },
          }),
        ),
      ).toBe(false);
    });
  });

  describe('getLibraryOptions', () => {
    it('should return Backblaze B2 configuration', () => {
      const options = getLibraryOptions();

      expect(options).toEqual({
        access_key_id: mockAccessKeyId,
        bucket: mockBucket,
        region: mockRegion,
      });
    });

    it('should return config from legacy media_library format', () => {
      vi.mocked(get).mockReturnValue({
        media_library: {
          name: 'backblaze_b2',
          access_key_id: mockAccessKeyId,
          bucket: mockBucket,
          region: mockRegion,
        },
      });

      const options = getLibraryOptions();

      expect(options).toMatchObject({
        name: 'backblaze_b2',
        access_key_id: mockAccessKeyId,
        bucket: mockBucket,
        region: mockRegion,
      });
    });

    it('should return undefined when neither media_libraries nor matching media_library exists', () => {
      vi.mocked(get).mockReturnValue({
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
          endpoint: `https://s3.${mockRegion}.backblazeb2.com`,
          public_url: `https://${mockBucket}.s3.${mockRegion}.backblazeb2.com`,
        }),
        mockOptions,
      );
    });

    it('list should use explicit public_url when set in config', async () => {
      const core = await import('./core');

      vi.mocked(get).mockReturnValue({
        media_libraries: {
          backblaze_b2: {
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
          endpoint: `https://s3.${mockRegion}.backblazeb2.com`,
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
          endpoint: `https://s3.${mockRegion}.backblazeb2.com`,
          public_url: `https://${mockBucket}.s3.${mockRegion}.backblazeb2.com`,
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
          endpoint: `https://s3.${mockRegion}.backblazeb2.com`,
          public_url: `https://${mockBucket}.s3.${mockRegion}.backblazeb2.com`,
          acl: false,
        }),
        mockOptions,
      );
    });

    it('list should reject when config is not available', async () => {
      vi.mocked(get).mockReturnValue({});

      await expect(
        list({ kind: undefined, apiKey: 'secret', fieldConfig: undefined }),
      ).rejects.toThrow('Backblaze B2 configuration is not available');
    });

    it('search should reject when config is not available', async () => {
      vi.mocked(get).mockReturnValue({});

      await expect(
        search('photo', { kind: undefined, apiKey: 'secret', fieldConfig: undefined }),
      ).rejects.toThrow('Backblaze B2 configuration is not available');
    });

    it('upload should reject when config is not available', async () => {
      vi.mocked(get).mockReturnValue({});

      await expect(upload([], { apiKey: 'secret', fieldConfig: undefined })).rejects.toThrow(
        'Backblaze B2 configuration is not available',
      );
    });
  });
});
