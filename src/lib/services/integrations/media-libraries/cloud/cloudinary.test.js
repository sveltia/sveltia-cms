import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import cloudinaryService, {
  getCloudConfig,
  list,
  parseResults,
  search,
  upload,
} from './cloudinary';

// Mock dependencies
vi.mock('svelte/store', () => ({
  get: vi.fn(),
}));

vi.mock('$lib/services/config', () => ({
  siteConfig: { subscribe: vi.fn() },
}));

vi.mock('@sveltia/utils/misc', () => ({
  sleep: vi.fn(),
}));

// Setup global fetch mock
global.fetch = vi.fn();

describe('integrations/media-libraries/cloud/cloudinary', () => {
  const mockCloudName = 'test-cloud';
  const mockApiKey = '123456789012345';
  const mockApiSecret = 'abcdefghijklmnopqrstuvwxyz1';

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock the siteConfig to return cloudinary config
    vi.mocked(get).mockReturnValue({
      media_libraries: {
        cloudinary: {
          config: {
            cloud_name: mockCloudName,
            api_key: mockApiKey,
          },
        },
      },
    });

    // Mock crypto.subtle.digest
    vi.spyOn(crypto.subtle, 'digest').mockResolvedValue(
      new Uint8Array([
        0x6a, 0x09, 0xe6, 0x67, 0xbb, 0x67, 0xae, 0x85, 0x84, 0xca, 0xa7, 0x3b, 0x3c, 0x6e, 0xf3,
        0x72,
      ]).buffer,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('service configuration', () => {
    it('should have correct service configuration', () => {
      expect(cloudinaryService.serviceType).toBe('cloud_storage');
      expect(cloudinaryService.serviceId).toBe('cloudinary');
      expect(cloudinaryService.serviceLabel).toBe('Cloudinary');
      expect(cloudinaryService.serviceURL).toBe('https://cloudinary.com/');
      expect(cloudinaryService.showServiceLink).toBe(true);
      expect(cloudinaryService.hotlinking).toBe(true);
      expect(cloudinaryService.authType).toBe('api_key');
      expect(cloudinaryService.developerURL).toBe('https://cloudinary.com/documentation/');
      expect(cloudinaryService.apiKeyURL).toBe('https://console.cloudinary.com/settings/api-keys');
      expect(cloudinaryService.apiKeyPattern).toBeInstanceOf(RegExp);
      // eslint-disable-next-line import/no-named-as-default-member
      expect(cloudinaryService.list).toBeDefined();
      // eslint-disable-next-line import/no-named-as-default-member
      expect(cloudinaryService.search).toBeDefined();
      // eslint-disable-next-line import/no-named-as-default-member
      expect(cloudinaryService.upload).toBeDefined();
    });

    it('should validate API key format', () => {
      const { apiKeyPattern } = cloudinaryService;

      if (!apiKeyPattern) {
        throw new Error('apiKeyPattern is not defined');
      }

      // Valid API keys (15+ alphanumeric, underscore, or hyphen chars)
      expect(apiKeyPattern.test('abc123DEF456ghi')).toBe(true);
      expect(apiKeyPattern.test('ABCDEFGHIJKLMNOPQRSTUVWXY_Z')).toBe(true);
      expect(apiKeyPattern.test('123456789012345')).toBe(true);
      expect(apiKeyPattern.test('key-with_hyphens123')).toBe(true);

      // Invalid API keys
      expect(apiKeyPattern.test('short')).toBe(false); // too short (< 15 chars)
      expect(apiKeyPattern.test('abc!@#$%^&*()1234567890123')).toBe(false); // invalid chars
      expect(apiKeyPattern.test('has spaces here')).toBe(false); // spaces not allowed
    });
  });

  describe('getCloudConfig', () => {
    it('should return cloudinary config from media_libraries', () => {
      const config = getCloudConfig();

      expect(config.cloudName).toBe(mockCloudName);
      expect(config.apiKey).toBe(mockApiKey);
      expect(get).toHaveBeenCalled();
    });

    it('should return empty object when config is missing', () => {
      vi.mocked(get).mockReturnValue({});

      const config = getCloudConfig();

      expect(config).toEqual({});
    });

    it('should return empty object when cloudinary config is missing', () => {
      vi.mocked(get).mockReturnValue({
        media_libraries: {},
      });

      const config = getCloudConfig();

      expect(config).toEqual({});
    });

    it('should support legacy media_library config', () => {
      vi.mocked(get).mockReturnValue({
        media_library: {
          name: 'cloudinary',
          config: {
            cloud_name: 'legacy-cloud',
            api_key: 'legacy-api-key',
          },
        },
      });

      const config = getCloudConfig();

      expect(config.cloudName).toBe('legacy-cloud');
      expect(config.apiKey).toBe('legacy-api-key');
    });
  });

  describe('parseResults', () => {
    it('should parse image resources correctly', () => {
      const mockResources = [
        {
          public_id: 'sample/image',
          format: 'jpg',
          resource_type: 'image',
          type: 'upload',
          secure_url: 'https://res.cloudinary.com/test-cloud/image/upload/v1/sample/image.jpg',
          bytes: 12345,
          created_at: '2025-01-01T00:00:00Z',
          width: 1920,
          height: 1080,
        },
      ];

      const results = parseResults(mockResources);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        id: 'sample/image',
        description: 'sample/image.jpg',
        previewURL:
          'https://res.cloudinary.com/test-cloud/image/upload/w_400,c_limit/v1/sample/image.jpg',
        downloadURL: 'https://res.cloudinary.com/test-cloud/image/upload/v1/sample/image.jpg',
        fileName: 'sample/image.jpg',
        kind: 'image',
      });
    });

    it('should parse video resources correctly', () => {
      const mockResources = [
        {
          public_id: 'videos/sample',
          format: 'mp4',
          resource_type: 'video',
          type: 'upload',
          secure_url: 'https://res.cloudinary.com/test-cloud/video/upload/v1/videos/sample.mp4',
          bytes: 98765,
          created_at: '2025-01-02T00:00:00Z',
        },
      ];

      const results = parseResults(mockResources);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        id: 'videos/sample',
        description: 'videos/sample.mp4',
        previewURL: 'https://res.cloudinary.com/test-cloud/video/upload/v1/videos/sample.mp4',
        downloadURL: 'https://res.cloudinary.com/test-cloud/video/upload/v1/videos/sample.mp4',
        fileName: 'videos/sample.mp4',
        kind: 'video',
      });
    });

    it('should parse raw resources correctly', () => {
      const mockResources = [
        {
          public_id: 'docs/document',
          format: 'pdf',
          resource_type: 'raw',
          type: 'upload',
          secure_url: 'https://res.cloudinary.com/test-cloud/raw/upload/v1/docs/document.pdf',
          bytes: 54321,
          created_at: '2025-01-03T00:00:00Z',
        },
      ];

      const results = parseResults(mockResources);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        id: 'docs/document',
        description: 'docs/document.pdf',
        previewURL: 'https://res.cloudinary.com/test-cloud/raw/upload/v1/docs/document.pdf',
        downloadURL: 'https://res.cloudinary.com/test-cloud/raw/upload/v1/docs/document.pdf',
        fileName: 'docs/document.pdf',
        kind: 'other',
      });
    });

    it('should parse multiple resources correctly', () => {
      const mockResources = [
        {
          public_id: 'img1',
          format: 'jpg',
          resource_type: 'image',
          type: 'upload',
          secure_url: 'https://res.cloudinary.com/test-cloud/image/upload/v1/img1.jpg',
          bytes: 100,
          created_at: '2025-01-01T00:00:00Z',
        },
        {
          public_id: 'img2',
          format: 'png',
          resource_type: 'image',
          type: 'upload',
          secure_url: 'https://res.cloudinary.com/test-cloud/image/upload/v1/img2.png',
          bytes: 200,
          created_at: '2025-01-02T00:00:00Z',
        },
      ];

      const results = parseResults(mockResources);

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('img1');
      expect(results[1].id).toBe('img2');
    });
  });

  describe('list', () => {
    it('should fetch resources successfully', async () => {
      const mockResponse = {
        resources: [
          {
            public_id: 'sample/image',
            format: 'jpg',
            resource_type: 'image',
            type: 'upload',
            secure_url: 'https://res.cloudinary.com/test-cloud/image/upload/v1/sample/image.jpg',
            bytes: 12345,
            created_at: '2025-01-01T00:00:00Z',
          },
        ],
        next_cursor: undefined,
        rate_limit_allowed: 500,
        rate_limit_remaining: 499,
        rate_limit_reset_at: Date.now() + 3600000,
      };

      vi.mocked(fetch).mockResolvedValueOnce(
        /** @type {any} */ ({
          ok: true,
          json: vi.fn().mockResolvedValue(mockResponse),
        }),
      );

      const results = await list({ apiKey: mockApiSecret });

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith(
        `https://api.cloudinary.com/v1_1/${mockCloudName}/resources/search`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: expect.stringMatching(/^Basic /),
          }),
          body: expect.any(String),
        }),
      );
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('sample/image');
    });

    it('should handle pagination', async () => {
      const mockResponsePage1 = {
        resources: [
          {
            public_id: 'img1',
            format: 'jpg',
            resource_type: 'image',
            type: 'upload',
            secure_url: 'https://res.cloudinary.com/test-cloud/image/upload/v1/img1.jpg',
            bytes: 100,
            created_at: '2025-01-01T00:00:00Z',
          },
        ],
        next_cursor: 'cursor123',
        rate_limit_allowed: 500,
        rate_limit_remaining: 499,
        rate_limit_reset_at: Date.now() + 3600000,
      };

      const mockResponsePage2 = {
        resources: [
          {
            public_id: 'img2',
            format: 'jpg',
            resource_type: 'image',
            type: 'upload',
            secure_url: 'https://res.cloudinary.com/test-cloud/image/upload/v1/img2.jpg',
            bytes: 200,
            created_at: '2025-01-02T00:00:00Z',
          },
        ],
        next_cursor: undefined,
        rate_limit_allowed: 500,
        rate_limit_remaining: 498,
        rate_limit_reset_at: Date.now() + 3600000,
      };

      vi.mocked(fetch)
        .mockResolvedValueOnce(
          /** @type {any} */ ({
            ok: true,
            json: vi.fn().mockResolvedValue(mockResponsePage1),
          }),
        )
        .mockResolvedValueOnce(
          /** @type {any} */ ({
            ok: true,
            json: vi.fn().mockResolvedValue(mockResponsePage2),
          }),
        );

      const results = await list({ apiKey: mockApiSecret });

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('img1');
      expect(results[1].id).toBe('img2');
    });

    it('should reject when cloud name is not configured', async () => {
      vi.mocked(get).mockReturnValue({});

      await expect(list({ apiKey: mockApiSecret })).rejects.toThrow(
        'Cloudinary cloud name is not configured',
      );
    });

    it('should reject when API key is not configured', async () => {
      vi.mocked(get).mockReturnValue({
        media_libraries: {
          cloudinary: {
            config: {
              cloud_name: mockCloudName,
            },
          },
        },
      });

      await expect(list({ apiKey: mockApiSecret })).rejects.toThrow(
        'Cloudinary API key is not configured',
      );
    });

    it('should reject when API secret is not provided', async () => {
      await expect(list({ apiKey: '' })).rejects.toThrow('Cloudinary API secret is not provided');
    });

    it('should reject when API request fails', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        /** @type {any} */ ({
          ok: false,
          text: vi.fn().mockResolvedValue('Unauthorized'),
        }),
      );

      await expect(list({ apiKey: mockApiSecret })).rejects.toThrow(
        'Failed to fetch resources: Unauthorized',
      );
    });

    it('should limit to 10 pages', async () => {
      const mockResponse = {
        resources: [
          {
            public_id: 'img',
            format: 'jpg',
            resource_type: 'image',
            type: 'upload',
            secure_url: 'https://res.cloudinary.com/test-cloud/image/upload/v1/img.jpg',
            bytes: 100,
            created_at: '2025-01-01T00:00:00Z',
          },
        ],
        next_cursor: 'next-cursor',
        rate_limit_allowed: 500,
        rate_limit_remaining: 490,
        rate_limit_reset_at: Date.now() + 3600000,
      };

      // Mock 10 pages
      for (let i = 0; i < 10; i += 1) {
        vi.mocked(fetch).mockResolvedValueOnce(
          /** @type {any} */ ({
            ok: true,
            json: vi.fn().mockResolvedValue(mockResponse),
          }),
        );
      }

      const results = await list({ apiKey: mockApiSecret });

      expect(fetch).toHaveBeenCalledTimes(10);
      expect(results).toHaveLength(10); // 1 result per page
    });
  });

  describe('search', () => {
    it('should search resources successfully', async () => {
      const mockResponse = {
        resources: [
          {
            public_id: 'test-image',
            format: 'jpg',
            resource_type: 'image',
            type: 'upload',
            secure_url: 'https://res.cloudinary.com/test-cloud/image/upload/v1/test-image.jpg',
            bytes: 12345,
            created_at: '2025-01-01T00:00:00Z',
          },
        ],
        next_cursor: undefined,
        rate_limit_allowed: 500,
        rate_limit_remaining: 499,
        rate_limit_reset_at: Date.now() + 3600000,
      };

      vi.mocked(fetch).mockResolvedValueOnce(
        /** @type {any} */ ({
          ok: true,
          json: vi.fn().mockResolvedValue(mockResponse),
        }),
      );

      const results = await search('test', { apiKey: mockApiSecret });

      expect(fetch).toHaveBeenCalledTimes(1);

      const fetchCall = vi.mocked(fetch).mock.calls[0];

      if (!fetchCall[1]) {
        throw new Error('Fetch call options are undefined');
      }

      const body = JSON.parse(/** @type {string} */ (fetchCall[1].body));

      expect(body.expression).toContain('test');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('test-image');
    });

    it('should build correct search expression', async () => {
      const mockResponse = {
        resources: [],
        next_cursor: undefined,
        rate_limit_allowed: 500,
        rate_limit_remaining: 499,
        rate_limit_reset_at: Date.now() + 3600000,
      };

      vi.mocked(fetch).mockResolvedValueOnce(
        /** @type {any} */ ({
          ok: true,
          json: vi.fn().mockResolvedValue(mockResponse),
        }),
      );

      await search('my-search', { apiKey: mockApiSecret });

      const fetchCall = vi.mocked(fetch).mock.calls[0];

      if (!fetchCall[1]) {
        throw new Error('Fetch call options are undefined');
      }

      const body = JSON.parse(/** @type {string} */ (fetchCall[1].body));

      expect(body.expression).toBe('public_id:*my-search* OR filename:*my-search*');
    });

    it('should handle pagination during search', async () => {
      const mockResponsePage1 = {
        resources: [
          {
            public_id: 'result1',
            format: 'jpg',
            resource_type: 'image',
            type: 'upload',
            secure_url: 'https://res.cloudinary.com/test-cloud/image/upload/v1/result1.jpg',
            bytes: 100,
            created_at: '2025-01-01T00:00:00Z',
          },
        ],
        next_cursor: 'cursor456',
        rate_limit_allowed: 500,
        rate_limit_remaining: 499,
        rate_limit_reset_at: Date.now() + 3600000,
      };

      const mockResponsePage2 = {
        resources: [
          {
            public_id: 'result2',
            format: 'jpg',
            resource_type: 'image',
            type: 'upload',
            secure_url: 'https://res.cloudinary.com/test-cloud/image/upload/v1/result2.jpg',
            bytes: 200,
            created_at: '2025-01-02T00:00:00Z',
          },
        ],
        next_cursor: undefined,
        rate_limit_allowed: 500,
        rate_limit_remaining: 498,
        rate_limit_reset_at: Date.now() + 3600000,
      };

      vi.mocked(fetch)
        .mockResolvedValueOnce(
          /** @type {any} */ ({
            ok: true,
            json: vi.fn().mockResolvedValue(mockResponsePage1),
          }),
        )
        .mockResolvedValueOnce(
          /** @type {any} */ ({
            ok: true,
            json: vi.fn().mockResolvedValue(mockResponsePage2),
          }),
        );

      const results = await search('result', { apiKey: mockApiSecret });

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('result1');
      expect(results[1].id).toBe('result2');
    });
  });

  describe('upload', () => {
    it('should upload a single file successfully', async () => {
      const mockFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });

      const mockResponse = {
        public_id: 'uploaded/test',
        format: 'jpg',
        resource_type: 'image',
        type: 'upload',
        secure_url: 'https://res.cloudinary.com/test-cloud/image/upload/v1/uploaded/test.jpg',
        bytes: 7,
        created_at: '2025-01-01T00:00:00Z',
      };

      vi.mocked(fetch).mockResolvedValueOnce(
        /** @type {any} */ ({
          ok: true,
          json: vi.fn().mockResolvedValue(mockResponse),
        }),
      );

      const results = await upload([mockFile], { apiKey: mockApiSecret });

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith(
        `https://api.cloudinary.com/v1_1/${mockCloudName}/auto/upload`,
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData),
        }),
      );
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('uploaded/test');
      expect(results[0].fileName).toBe('uploaded/test.jpg');
    });

    it('should upload multiple files successfully', async () => {
      const mockFile1 = new File(['content1'], 'test1.jpg', { type: 'image/jpeg' });
      const mockFile2 = new File(['content2'], 'test2.png', { type: 'image/png' });

      const mockResponse1 = {
        public_id: 'uploaded/test1',
        format: 'jpg',
        resource_type: 'image',
        type: 'upload',
        secure_url: 'https://res.cloudinary.com/test-cloud/image/upload/v1/uploaded/test1.jpg',
        bytes: 8,
        created_at: '2025-01-01T00:00:00Z',
      };

      const mockResponse2 = {
        public_id: 'uploaded/test2',
        format: 'png',
        resource_type: 'image',
        type: 'upload',
        secure_url: 'https://res.cloudinary.com/test-cloud/image/upload/v1/uploaded/test2.png',
        bytes: 8,
        created_at: '2025-01-01T00:00:00Z',
      };

      vi.mocked(fetch)
        .mockResolvedValueOnce(
          /** @type {any} */ ({
            ok: true,
            json: vi.fn().mockResolvedValue(mockResponse1),
          }),
        )
        .mockResolvedValueOnce(
          /** @type {any} */ ({
            ok: true,
            json: vi.fn().mockResolvedValue(mockResponse2),
          }),
        );

      const results = await upload([mockFile1, mockFile2], { apiKey: mockApiSecret });

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('uploaded/test1');
      expect(results[1].id).toBe('uploaded/test2');
    });

    it('should return empty array for empty file list', async () => {
      const results = await upload([], { apiKey: mockApiSecret });

      expect(results).toEqual([]);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should reject when cloud name is not configured', async () => {
      vi.mocked(get).mockReturnValue({});

      const mockFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });

      await expect(upload([mockFile], { apiKey: mockApiSecret })).rejects.toThrow(
        'Cloudinary cloud name is not configured',
      );
    });

    it('should reject when API key is not configured', async () => {
      vi.mocked(get).mockReturnValue({
        media_libraries: {
          cloudinary: {
            config: {
              cloud_name: mockCloudName,
            },
          },
        },
      });

      const mockFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });

      await expect(upload([mockFile], { apiKey: mockApiSecret })).rejects.toThrow(
        'Cloudinary API key is not configured',
      );
    });

    it('should reject when API secret is not provided', async () => {
      const mockFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });

      await expect(upload([mockFile], { apiKey: '' })).rejects.toThrow(
        'Cloudinary API secret is not provided',
      );
    });

    it('should reject when upload fails', async () => {
      const mockFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });

      vi.mocked(fetch).mockResolvedValueOnce(
        /** @type {any} */ ({
          ok: false,
          text: vi.fn().mockResolvedValue('Upload failed'),
        }),
      );

      await expect(upload([mockFile], { apiKey: mockApiSecret })).rejects.toThrow(
        'Failed to upload file test.jpg: Upload failed',
      );
    });

    it('should include signature in upload request', async () => {
      const mockFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });

      const mockResponse = {
        public_id: 'uploaded/test',
        format: 'jpg',
        resource_type: 'image',
        type: 'upload',
        secure_url: 'https://res.cloudinary.com/test-cloud/image/upload/v1/uploaded/test.jpg',
        bytes: 7,
        created_at: '2025-01-01T00:00:00Z',
      };

      vi.mocked(fetch).mockResolvedValueOnce(
        /** @type {any} */ ({
          ok: true,
          json: vi.fn().mockResolvedValue(mockResponse),
        }),
      );

      await upload([mockFile], { apiKey: mockApiSecret });

      expect(crypto.subtle.digest).toHaveBeenCalledWith('SHA-256', expect.any(Uint8Array));

      const fetchCall = vi.mocked(fetch).mock.calls[0];

      if (!fetchCall[1]) {
        throw new Error('Fetch call options are undefined');
      }

      const formData = /** @type {FormData} */ (fetchCall[1].body);

      expect(formData.get('signature')).toBeTruthy();
      expect(formData.get('timestamp')).toBeTruthy();
      expect(formData.get('api_key')).toBe(mockApiKey);
    });
  });
});
