import { get } from 'svelte/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import cloudflareR2Service, {
  getLibraryOptions,
  isEnabled,
  list,
  search,
  upload,
} from './cloudflare-r2';

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

describe('integrations/media-libraries/cloud/s3/cloudflare-r2', () => {
  const mockAccessKeyId = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
  const mockBucket = 'my-bucket';
  const mockAccountId = 'abcdef1234567890abcdef1234567890';

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(get).mockReturnValue({
      media_libraries: {
        cloudflare_r2: {
          access_key_id: mockAccessKeyId,
          bucket: mockBucket,
          account_id: mockAccountId,
        },
      },
    });
  });

  describe('service configuration', () => {
    it('should have correct service configuration', () => {
      expect(cloudflareR2Service.serviceType).toBe('cloud_storage');
      expect(cloudflareR2Service.serviceId).toBe('cloudflare_r2');
      expect(cloudflareR2Service.serviceLabel).toBe('Cloudflare R2');
      expect(cloudflareR2Service.serviceURL).toBe(
        'https://www.cloudflare.com/developer-platform/r2/',
      );
      expect(cloudflareR2Service.showServiceLink).toBe(true);
      expect(cloudflareR2Service.hotlinking).toBe(true);
      expect(cloudflareR2Service.authType).toBe('api_key');
      expect(cloudflareR2Service.developerURL).toBe('https://developers.cloudflare.com/r2/');
      expect(cloudflareR2Service.apiKeyURL).toBe(
        'https://dash.cloudflare.com/?to=/:account/r2/api-tokens',
      );
      expect(cloudflareR2Service.apiKeyPattern).toBeInstanceOf(RegExp);
      // eslint-disable-next-line import-x/no-named-as-default-member
      expect(cloudflareR2Service.isEnabled).toBeDefined();
    });

    it('should validate secret access key format', () => {
      const { apiKeyPattern } = cloudflareR2Service;

      if (!apiKeyPattern) {
        throw new Error('apiKeyPattern is not defined');
      }

      // Valid secret access keys (40+ base64-like chars)
      expect(apiKeyPattern.test('abcdefghijklmnopqrstuvwxyz1234567890ABCD')).toBe(true);
      expect(apiKeyPattern.test('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY')).toBe(true);
      expect(apiKeyPattern.test('a/b+c=1234567890123456789012345678901234')).toBe(true);

      // Invalid secret access keys
      expect(apiKeyPattern.test('abcdef123456')).toBe(false); // too short
      expect(apiKeyPattern.test('abcdef-1234567890abcdef12345')).toBe(false); // invalid char
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
          cloudflare_r2: {},
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
              cloudflare_r2: {
                access_key_id: mockAccessKeyId,
                bucket: mockBucket,
                account_id: mockAccountId,
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
              cloudflare_r2: {},
            },
          }),
        ),
      ).toBe(false);
    });
  });

  describe('getLibraryOptions', () => {
    it('should return R2 configuration', () => {
      const options = getLibraryOptions();

      expect(options).toEqual({
        access_key_id: mockAccessKeyId,
        bucket: mockBucket,
        account_id: mockAccountId,
      });
    });

    it('should return config from legacy media_library format', () => {
      vi.mocked(get).mockReturnValue({
        media_library: {
          name: 'cloudflare_r2',
          access_key_id: mockAccessKeyId,
          bucket: mockBucket,
          account_id: mockAccountId,
        },
      });

      const options = getLibraryOptions();

      expect(options).toMatchObject({
        name: 'cloudflare_r2',
        access_key_id: mockAccessKeyId,
        bucket: mockBucket,
        account_id: mockAccountId,
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

    it('list should pass R2 endpoint and auto region to listS3Objects', async () => {
      const core = await import('./core');

      await list(mockOptions);

      expect(core.listS3Objects).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: `https://${mockAccountId}.r2.cloudflarestorage.com`,
          region: 'auto',
        }),
        mockOptions,
      );
    });

    it('list should pass public_url through when set in config', async () => {
      const core = await import('./core');

      vi.mocked(get).mockReturnValue({
        media_libraries: {
          cloudflare_r2: {
            access_key_id: mockAccessKeyId,
            bucket: mockBucket,
            account_id: mockAccountId,
            public_url: 'https://pub-abc123.r2.dev',
          },
        },
      });

      await list(mockOptions);

      expect(core.listS3Objects).toHaveBeenCalledWith(
        expect.objectContaining({ public_url: 'https://pub-abc123.r2.dev' }),
        mockOptions,
      );
    });

    it('search should pass R2 endpoint and auto region to searchS3Objects', async () => {
      const core = await import('./core');

      await search('photo', mockOptions);

      expect(core.searchS3Objects).toHaveBeenCalledWith(
        'photo',
        expect.objectContaining({
          endpoint: `https://${mockAccountId}.r2.cloudflarestorage.com`,
          region: 'auto',
        }),
        mockOptions,
      );
    });

    it('upload should pass R2 endpoint and auto region to uploadToS3', async () => {
      const core = await import('./core');

      await upload([], mockOptions);

      expect(core.uploadToS3).toHaveBeenCalledWith(
        [],
        expect.objectContaining({
          endpoint: `https://${mockAccountId}.r2.cloudflarestorage.com`,
          region: 'auto',
        }),
        mockOptions,
      );
    });

    it('list should reject when config is not available', async () => {
      vi.mocked(get).mockReturnValue({});

      await expect(
        list({
          kind: /** @type {undefined} */ (undefined),
          apiKey: 'secret',
          fieldConfig: undefined,
        }),
      ).rejects.toThrow('Cloudflare R2 configuration is not available');
    });

    it('search should reject when config is not available', async () => {
      vi.mocked(get).mockReturnValue({});

      await expect(
        search('photo', {
          kind: /** @type {undefined} */ (undefined),
          apiKey: 'secret',
          fieldConfig: undefined,
        }),
      ).rejects.toThrow('Cloudflare R2 configuration is not available');
    });

    it('upload should reject when config is not available', async () => {
      vi.mocked(get).mockReturnValue({});

      await expect(upload([], { apiKey: 'secret', fieldConfig: undefined })).rejects.toThrow(
        'Cloudflare R2 configuration is not available',
      );
    });
  });
});
