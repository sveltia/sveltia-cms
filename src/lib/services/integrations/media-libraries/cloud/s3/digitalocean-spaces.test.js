import { get } from 'svelte/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import digitalOceanSpacesService, {
  getLibraryOptions,
  isEnabled,
  list,
  search,
  upload,
} from './digitalocean-spaces';

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

describe('integrations/media-libraries/cloud/s3/digitalocean-spaces', () => {
  const mockAccessKeyId = 'ABCD1234EFGH5678IJKL';
  const mockBucket = 'my-space';
  const mockRegion = 'nyc3';

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(get).mockReturnValue({
      media_libraries: {
        digitalocean_spaces: {
          access_key_id: mockAccessKeyId,
          bucket: mockBucket,
          region: mockRegion,
        },
      },
    });
  });

  describe('service configuration', () => {
    it('should have correct service configuration', () => {
      expect(digitalOceanSpacesService.serviceType).toBe('cloud_storage');
      expect(digitalOceanSpacesService.serviceId).toBe('digitalocean_spaces');
      expect(digitalOceanSpacesService.serviceLabel).toBe('DigitalOcean Spaces');
      expect(digitalOceanSpacesService.serviceURL).toBe(
        'https://www.digitalocean.com/products/spaces',
      );
      expect(digitalOceanSpacesService.showServiceLink).toBe(true);
      expect(digitalOceanSpacesService.hotlinking).toBe(true);
      expect(digitalOceanSpacesService.authType).toBe('api_key');
      expect(digitalOceanSpacesService.developerURL).toBe(
        'https://docs.digitalocean.com/products/spaces/',
      );
      expect(digitalOceanSpacesService.apiKeyURL).toBe(
        'https://cloud.digitalocean.com/account/api/spaces',
      );
      expect(digitalOceanSpacesService.apiKeyPattern).toBeInstanceOf(RegExp);
      // eslint-disable-next-line import-x/no-named-as-default-member
      expect(digitalOceanSpacesService.isEnabled).toBeDefined();
    });

    it('should validate secret access key format', () => {
      const { apiKeyPattern } = digitalOceanSpacesService;

      if (!apiKeyPattern) {
        throw new Error('apiKeyPattern is not defined');
      }

      // Valid secret access keys (43 base64-like chars)
      expect(apiKeyPattern.test('abcdefghijklmnopqrstuvwxyz1234567890ABCDEFG')).toBe(true);
      expect(apiKeyPattern.test('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY/AB')).toBe(true);

      // Invalid secret access keys
      expect(apiKeyPattern.test('abcd1234efgh5678ijkl')).toBe(false); // too short
      expect(apiKeyPattern.test('ABCD1234')).toBe(false); // too short
      expect(apiKeyPattern.test('ABCD-1234-EFGH-5678-IJKL')).toBe(false); // invalid char
      expect(apiKeyPattern.test('abcdefghijklmnopqrstuvwxyz1234567890ABCD')).toBe(false); // 40 chars (wrong length)
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
          digitalocean_spaces: {},
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
              digitalocean_spaces: {
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
              digitalocean_spaces: {},
            },
          }),
        ),
      ).toBe(false);
    });
  });

  describe('getLibraryOptions', () => {
    it('should return Spaces configuration', () => {
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
          name: 'digitalocean_spaces',
          access_key_id: mockAccessKeyId,
          bucket: mockBucket,
          region: mockRegion,
        },
      });

      const options = getLibraryOptions();

      expect(options).toMatchObject({
        name: 'digitalocean_spaces',
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
          endpoint: `https://${mockRegion}.digitaloceanspaces.com`,
          public_url: `https://${mockBucket}.${mockRegion}.digitaloceanspaces.com`,
        }),
        mockOptions,
      );
    });

    it('list should use explicit public_url when set in config', async () => {
      const core = await import('./core');

      vi.mocked(get).mockReturnValue({
        media_libraries: {
          digitalocean_spaces: {
            access_key_id: mockAccessKeyId,
            bucket: mockBucket,
            region: mockRegion,
            public_url: 'https://my-space.nyc3.cdn.digitaloceanspaces.com',
          },
        },
      });

      await list(mockOptions);

      expect(core.listS3Objects).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: `https://${mockRegion}.digitaloceanspaces.com`,
          public_url: 'https://my-space.nyc3.cdn.digitaloceanspaces.com',
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
          endpoint: `https://${mockRegion}.digitaloceanspaces.com`,
          public_url: `https://${mockBucket}.${mockRegion}.digitaloceanspaces.com`,
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
          endpoint: `https://${mockRegion}.digitaloceanspaces.com`,
          public_url: `https://${mockBucket}.${mockRegion}.digitaloceanspaces.com`,
        }),
        mockOptions,
      );
    });

    it('list should reject when config is not available', async () => {
      vi.mocked(get).mockReturnValue({});

      await expect(
        list({ kind: undefined, apiKey: 'secret', fieldConfig: undefined }),
      ).rejects.toThrow('DigitalOcean Spaces configuration is not available');
    });

    it('search should reject when config is not available', async () => {
      vi.mocked(get).mockReturnValue({});

      await expect(
        search('photo', { kind: undefined, apiKey: 'secret', fieldConfig: undefined }),
      ).rejects.toThrow('DigitalOcean Spaces configuration is not available');
    });

    it('upload should reject when config is not available', async () => {
      vi.mocked(get).mockReturnValue({});

      await expect(upload([], { apiKey: 'secret', fieldConfig: undefined })).rejects.toThrow(
        'DigitalOcean Spaces configuration is not available',
      );
    });
  });
});
