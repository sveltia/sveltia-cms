import { get } from 'svelte/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import supabaseStorageService, {
  getLibraryOptions,
  isEnabled,
  list,
  search,
  upload,
} from './supabase';

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

describe('integrations/media-libraries/cloud/s3/supabase-storage', () => {
  const mockAccessKeyId = 'abcdefghijklmnopqrst12345678901234567890';
  const mockBucket = 'my-bucket';
  const mockProjectId = 'abcdefghijklmnopqrst';
  const mockRegion = 'us-east-1';

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(get).mockReturnValue({
      media_libraries: {
        supabase_storage: {
          access_key_id: mockAccessKeyId,
          bucket: mockBucket,
          project_id: mockProjectId,
          region: mockRegion,
        },
      },
    });
  });

  describe('service configuration', () => {
    it('should have correct service configuration', () => {
      expect(supabaseStorageService.serviceType).toBe('cloud_storage');
      expect(supabaseStorageService.serviceId).toBe('supabase_storage');
      expect(supabaseStorageService.serviceLabel).toBe('Supabase Storage');
      expect(supabaseStorageService.serviceURL).toBe('https://supabase.com/storage');
      expect(supabaseStorageService.showServiceLink).toBe(true);
      expect(supabaseStorageService.hotlinking).toBe(true);
      expect(supabaseStorageService.authType).toBe('api_key');
      expect(supabaseStorageService.developerURL).toBe('https://supabase.com/docs/guides/storage');
      expect(supabaseStorageService.apiKeyURL).toBe(
        'https://supabase.com/dashboard/project/_/storage/settings',
      );
      expect(supabaseStorageService.apiKeyPattern).toBeInstanceOf(RegExp);
      // eslint-disable-next-line import-x/no-named-as-default-member
      expect(supabaseStorageService.isEnabled).toBeDefined();
    });

    it('should validate secret access key format', () => {
      const { apiKeyPattern } = supabaseStorageService;

      if (!apiKeyPattern) {
        throw new Error('apiKeyPattern is not defined');
      }

      // Valid secret access keys (40+ base64-like chars)
      expect(apiKeyPattern.test('abcdefghijklmnopqrstuvwxyz1234567890ABCD')).toBe(true);
      expect(apiKeyPattern.test('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY')).toBe(true);
      expect(apiKeyPattern.test('a/b+c=1234567890123456789012345678901234')).toBe(true);

      // Invalid secret access keys
      expect(apiKeyPattern.test('short')).toBe(false); // too short
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
          supabase_storage: {},
        },
      });

      expect(isEnabled()).toBe(false);
    });

    it('should return false when project_id is missing', () => {
      vi.mocked(get).mockReturnValue({
        media_libraries: {
          supabase_storage: {
            access_key_id: mockAccessKeyId,
            bucket: mockBucket,
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
              supabase_storage: {
                access_key_id: mockAccessKeyId,
                bucket: mockBucket,
                project_id: mockProjectId,
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
              supabase_storage: {},
            },
          }),
        ),
      ).toBe(false);
    });
  });

  describe('getLibraryOptions', () => {
    it('should return Supabase Storage configuration', () => {
      const options = getLibraryOptions();

      expect(options).toEqual({
        access_key_id: mockAccessKeyId,
        bucket: mockBucket,
        project_id: mockProjectId,
        region: mockRegion,
      });
    });

    it('should return config from legacy media_library format', () => {
      vi.mocked(get).mockReturnValue({
        media_library: {
          name: 'supabase_storage',
          access_key_id: mockAccessKeyId,
          bucket: mockBucket,
          project_id: mockProjectId,
          region: mockRegion,
        },
      });

      const options = getLibraryOptions();

      expect(options).toMatchObject({
        name: 'supabase_storage',
        access_key_id: mockAccessKeyId,
        bucket: mockBucket,
        project_id: mockProjectId,
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

    it('list should use Supabase S3 endpoint and derive public_url with bucket path', async () => {
      const core = await import('./core');

      await list(mockOptions);

      expect(core.listS3Objects).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: `https://${mockProjectId}.storage.supabase.co/storage/v1/s3`,
          public_url: `https://${mockProjectId}.supabase.co/storage/v1/object/public/${mockBucket}`,
        }),
        mockOptions,
      );
    });

    it('list should use explicit public_url when set in config', async () => {
      const core = await import('./core');

      vi.mocked(get).mockReturnValue({
        media_libraries: {
          supabase_storage: {
            access_key_id: mockAccessKeyId,
            bucket: mockBucket,
            project_id: mockProjectId,
            region: mockRegion,
            public_url: 'https://my-cdn.example.com',
          },
        },
      });

      await list(mockOptions);

      expect(core.listS3Objects).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: `https://${mockProjectId}.storage.supabase.co/storage/v1/s3`,
          public_url: 'https://my-cdn.example.com',
        }),
        mockOptions,
      );
    });

    it('search should use Supabase S3 endpoint and derive public_url', async () => {
      const core = await import('./core');

      await search('photo', mockOptions);

      expect(core.searchS3Objects).toHaveBeenCalledWith(
        'photo',
        expect.objectContaining({
          endpoint: `https://${mockProjectId}.storage.supabase.co/storage/v1/s3`,
          public_url: `https://${mockProjectId}.supabase.co/storage/v1/object/public/${mockBucket}`,
        }),
        mockOptions,
      );
    });

    it('upload should use Supabase S3 endpoint and derive public_url', async () => {
      const core = await import('./core');

      await upload([], mockOptions);

      expect(core.uploadToS3).toHaveBeenCalledWith(
        [],
        expect.objectContaining({
          endpoint: `https://${mockProjectId}.storage.supabase.co/storage/v1/s3`,
          public_url: `https://${mockProjectId}.supabase.co/storage/v1/object/public/${mockBucket}`,
        }),
        mockOptions,
      );
    });

    it('list should reject when config is not available', async () => {
      vi.mocked(get).mockReturnValue({});

      await expect(
        list({ kind: undefined, apiKey: 'secret', fieldConfig: undefined }),
      ).rejects.toThrow('Supabase Storage configuration is not available');
    });

    it('search should reject when config is not available', async () => {
      vi.mocked(get).mockReturnValue({});

      await expect(
        search('photo', { kind: undefined, apiKey: 'secret', fieldConfig: undefined }),
      ).rejects.toThrow('Supabase Storage configuration is not available');
    });

    it('upload should reject when config is not available', async () => {
      vi.mocked(get).mockReturnValue({});

      await expect(upload([], { apiKey: 'secret', fieldConfig: undefined })).rejects.toThrow(
        'Supabase Storage configuration is not available',
      );
    });
  });
});
