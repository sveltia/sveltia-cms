import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import cloudinaryService, {
  fetchResources,
  generateAuthHeader,
  generateSignature,
  getCloudConfig,
  getLibraryOptions,
  getMergedLibraryOptions,
  isEnabled,
  list,
  parseResults,
  search,
  transformationToString,
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
      expect(cloudinaryService.authType).toBe('widget');
      expect(cloudinaryService.developerURL).toBe('https://cloudinary.com/documentation/');
      expect(cloudinaryService.apiKeyURL).toBe('https://console.cloudinary.com/settings/api-keys');
      expect(cloudinaryService.apiKeyPattern).toBeInstanceOf(RegExp);
      // eslint-disable-next-line import/no-named-as-default-member
      expect(cloudinaryService.isEnabled).toBeDefined();
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

  describe('getLibraryOptions', () => {
    it('should return cloudinary library options from media_libraries', () => {
      const options = getLibraryOptions();

      expect(options).toBeDefined();
      expect(options?.config?.cloud_name).toBe(mockCloudName);
      expect(options?.config?.api_key).toBe(mockApiKey);
    });

    it('should return undefined when config is missing', () => {
      vi.mocked(get).mockReturnValue({});

      const options = getLibraryOptions();

      expect(options).toBeUndefined();
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

      const options = getLibraryOptions();

      expect(options).toBeDefined();
      expect(options?.config?.cloud_name).toBe('legacy-cloud');
    });

    it('should return undefined for non-cloudinary media_library', () => {
      vi.mocked(get).mockReturnValue({
        media_library: {
          name: 'other-service',
          config: {},
        },
      });

      const options = getLibraryOptions();

      expect(options).toBeUndefined();
    });

    it('should accept media_library config without name when site config has cloudinary media_library', () => {
      vi.mocked(get)
        .mockReturnValueOnce({
          media_library: {
            name: 'cloudinary',
            config: {
              cloud_name: 'site-cloud',
              api_key: 'site-key',
            },
          },
        })
        .mockReturnValueOnce({
          media_library: {
            name: 'cloudinary',
            config: {
              cloud_name: 'site-cloud',
              api_key: 'site-key',
            },
          },
        });

      const fieldConfig = /** @type {any} */ ({
        media_library: {
          // No name property - should fall back to site config check
          config: {
            cloud_name: 'field-cloud',
            api_key: 'field-key',
          },
        },
      });

      const options = getLibraryOptions(fieldConfig);

      expect(options).toBeDefined();
      expect(options?.config?.cloud_name).toBe('field-cloud');
    });
  });

  describe('getMergedLibraryOptions', () => {
    it('should return site config when field config has no cloudinary options', () => {
      vi.mocked(get).mockReturnValue({
        media_libraries: {
          cloudinary: {
            config: {
              cloud_name: 'site-cloud',
              api_key: 'site-key',
            },
          },
        },
      });

      const merged = getMergedLibraryOptions(/** @type {any} */ ({}));

      expect(merged.config?.cloud_name).toBe('site-cloud');
      expect(merged.config?.api_key).toBe('site-key');
    });

    it('should merge site and field config when both have cloudinary options', () => {
      vi.mocked(get)
        .mockReturnValueOnce({
          media_libraries: {
            cloudinary: {
              config: {
                cloud_name: 'site-cloud',
                api_key: 'site-key',
                default_transformations: [
                  [
                    {
                      width: 400,
                      crop: 'fill',
                    },
                  ],
                ],
              },
            },
          },
        })
        .mockReturnValueOnce({
          media_library: {
            name: 'cloudinary',
            config: {
              cloud_name: 'field-cloud',
              use_transformations: false,
            },
          },
        });

      const fieldConfig = /** @type {any} */ ({
        media_library: {
          name: 'cloudinary',
          config: {
            cloud_name: 'field-cloud',
            use_transformations: false,
          },
        },
      });

      const merged = getMergedLibraryOptions(fieldConfig);

      // Field config should override site config for cloud_name
      expect(merged.config?.cloud_name).toBe('field-cloud');
      expect(merged.config?.use_transformations).toBe(false);
    });

    it('should handle undefined site config', () => {
      vi.mocked(get).mockReturnValue({});

      const merged = getMergedLibraryOptions(/** @type {any} */ ({}));

      expect(merged.config).toEqual({});
    });

    it('should use site config when field config is undefined', () => {
      vi.mocked(get).mockReturnValue({
        media_libraries: {
          cloudinary: {
            config: {
              cloud_name: 'site-cloud',
              api_key: 'site-key',
            },
          },
        },
      });

      const merged = getMergedLibraryOptions(undefined);

      expect(merged.config?.cloud_name).toBe('site-cloud');
      expect(merged.config?.api_key).toBe('site-key');
    });

    it('should merge top-level properties with site options taking precedence then field options', () => {
      vi.mocked(get)
        .mockReturnValueOnce({
          media_libraries: {
            cloudinary: {
              label: 'Site Label',
              config: {
                cloud_name: 'site-cloud',
              },
            },
          },
        })
        .mockReturnValueOnce(undefined);

      const fieldConfig = /** @type {any} */ ({});
      const merged = getMergedLibraryOptions(fieldConfig);

      expect(merged.config?.cloud_name).toBe('site-cloud');
    });

    it('should deeply merge config objects', () => {
      vi.mocked(get)
        .mockReturnValueOnce({
          media_libraries: {
            cloudinary: {
              config: {
                cloud_name: 'site-cloud',
                api_key: 'site-key',
                transform_a: 'site-value',
              },
            },
          },
        })
        .mockReturnValueOnce(undefined);

      const merged = getMergedLibraryOptions(/** @type {any} */ ({}));

      expect(merged.config?.cloud_name).toBe('site-cloud');
      expect(merged.config?.api_key).toBe('site-key');
      expect(merged.config?.transform_a).toBe('site-value');
    });
  });

  describe('isEnabled', () => {
    it('should return true when cloud name and API key are configured', () => {
      expect(isEnabled()).toBe(true);
    });

    it('should return false when config is missing', () => {
      vi.mocked(get).mockReturnValue({});

      expect(isEnabled()).toBe(false);
    });

    it('should return false when cloud name is missing', () => {
      vi.mocked(get).mockReturnValue({
        media_libraries: {
          cloudinary: {
            config: {
              api_key: mockApiKey,
            },
          },
        },
      });

      expect(isEnabled()).toBe(false);
    });

    it('should return false when API key is missing', () => {
      vi.mocked(get).mockReturnValue({
        media_libraries: {
          cloudinary: {
            config: {
              cloud_name: mockCloudName,
            },
          },
        },
      });

      expect(isEnabled()).toBe(false);
    });
  });

  describe('transformationToString', () => {
    it('should convert basic transformation to string', () => {
      const result = transformationToString({ width: 400, height: 300 });

      expect(result).toBe('w_400,h_300');
    });

    it('should use abbreviations for known parameters', () => {
      const result = transformationToString({
        width: 400,
        crop: 'fill',
        quality: 80,
        fetch_format: 'jpg',
      });

      expect(result).toBe('w_400,c_fill,q_80,f_jpg');
    });

    it('should handle boolean flags', () => {
      const result = transformationToString({ progressive: true });

      expect(result).toContain('progressive');
    });

    it('should skip false boolean flags', () => {
      const result = transformationToString({ progressive: false, width: 100 });

      expect(result).toBe('w_100');
    });

    it('should handle array values', () => {
      const result = transformationToString({ flags: ['progressive', 'lossy'] });

      expect(result).toBe('fl_progressive.lossy');
    });

    it('should skip undefined and null values', () => {
      const result = transformationToString({
        width: 400,
        height: undefined,
        crop: null,
        quality: 80,
      });

      expect(result).toBe('w_400,q_80');
    });

    it('should handle custom parameters not in the map', () => {
      const result = transformationToString({ custom_param: 'value', width: 400 });

      expect(result).toContain('custom_param_value');
      expect(result).toContain('w_400');
    });

    it('should return empty string for empty transformation', () => {
      const result = transformationToString({});

      expect(result).toBe('');
    });
  });

  describe('generateAuthHeader', () => {
    it('should generate Basic Auth header', () => {
      const result = generateAuthHeader('test-key', 'test-secret');

      expect(result).toMatch(/^Basic /);
      expect(result).toBe(`Basic ${btoa('test-key:test-secret')}`);
    });

    it('should encode credentials correctly', () => {
      const apiKey = mockApiKey;
      const apiSecret = mockApiSecret;
      const result = generateAuthHeader(apiKey, apiSecret);
      const expectedEncoded = btoa(`${apiKey}:${apiSecret}`);

      expect(result).toBe(`Basic ${expectedEncoded}`);
    });
  });

  describe('generateSignature', () => {
    it('should generate signature from parameters', async () => {
      const params = { timestamp: 1234567890, public_id: 'test' };
      const signature = await generateSignature(params, mockApiSecret);

      expect(signature).toBeDefined();
      expect(typeof signature).toBe('string');
      expect(signature.length).toBeGreaterThan(0);
      expect(crypto.subtle.digest).toHaveBeenCalledWith('SHA-256', expect.any(Uint8Array));
    });

    it('should sort parameters alphabetically', async () => {
      const params = { z_param: 'z', a_param: 'a', m_param: 'm' };
      const signature = await generateSignature(params, mockApiSecret);

      expect(signature).toBeDefined();

      // The signature should be consistent because params are sorted
      const signature2 = await generateSignature(params, mockApiSecret);

      expect(signature).toBe(signature2);
    });

    it('should include API secret in signature', async () => {
      const params = { timestamp: 1234567890 };

      // Mock different digest outputs for different inputs
      vi.spyOn(crypto.subtle, 'digest')
        .mockResolvedValueOnce(
          new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]).buffer,
        )
        .mockResolvedValueOnce(
          new Uint8Array([0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10]).buffer,
        );

      const signature1 = await generateSignature(params, 'secret1');
      const signature2 = await generateSignature(params, 'secret2');

      // Different secrets should produce different signatures
      expect(signature1).not.toBe(signature2);
    });

    it('should return hex string', async () => {
      const params = { timestamp: 1234567890 };
      const signature = await generateSignature(params, mockApiSecret);

      expect(signature).toMatch(/^[0-9a-f]+$/);
    });
  });

  describe('parseResults', () => {
    it('should parse image resources correctly', () => {
      const mockResources = [
        {
          asset_id: 'asset-123',
          filename: 'sample/image',
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
        id: 'asset-123',
        description: 'image.jpg',
        previewURL:
          'https://res.cloudinary.com/test-cloud/image/upload/w_400,c_limit/v1/sample/image.jpg',
        downloadURL: 'https://res.cloudinary.com/test-cloud/image/upload/v1/sample/image.jpg',
        fileName: 'image.jpg',
        lastModified: new Date('2025-01-01T00:00:00Z'),
        size: 12345,
        kind: 'image',
      });
    });

    it('should parse video resources correctly', () => {
      const mockResources = [
        {
          asset_id: 'asset-456',
          filename: 'videos/sample',
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
        id: 'asset-456',
        description: 'sample.mp4',
        previewURL:
          'https://res.cloudinary.com/test-cloud/video/upload/w_400,c_limit/v1/videos/sample.mp4',
        downloadURL: 'https://res.cloudinary.com/test-cloud/video/upload/v1/videos/sample.mp4',
        fileName: 'sample.mp4',
        lastModified: new Date('2025-01-02T00:00:00Z'),
        size: 98765,
        kind: 'video',
      });
    });

    it('should parse raw resources correctly', () => {
      const mockResources = [
        {
          asset_id: 'asset-789',
          filename: 'docs/document',
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
        id: 'asset-789',
        description: 'document.pdf',
        previewURL:
          'https://res.cloudinary.com/test-cloud/raw/upload/w_400,c_limit/v1/docs/document.pdf',
        downloadURL: 'https://res.cloudinary.com/test-cloud/raw/upload/v1/docs/document.pdf',
        fileName: 'document.pdf',
        lastModified: new Date('2025-01-03T00:00:00Z'),
        size: 54321,
        kind: 'other',
      });
    });

    it('should parse multiple resources correctly', () => {
      const mockResources = [
        {
          asset_id: 'asset-1',
          filename: 'img1',
          format: 'jpg',
          resource_type: 'image',
          type: 'upload',
          secure_url: 'https://res.cloudinary.com/test-cloud/image/upload/v1/img1.jpg',
          bytes: 100,
          created_at: '2025-01-01T00:00:00Z',
        },
        {
          asset_id: 'asset-2',
          filename: 'img2',
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
      expect(results[0].id).toBe('asset-1');
      expect(results[1].id).toBe('asset-2');
    });

    it('should handle fileNameOnly option', () => {
      // Test lines 268-270: when fileNameOnly is true
      const mockResources = [
        {
          asset_id: 'asset-123',
          filename: 'sample/image',
          format: 'jpg',
          resource_type: 'image',
          type: 'upload',
          secure_url: 'https://res.cloudinary.com/test-cloud/image/upload/v1/sample/image.jpg',
          bytes: 12345,
          created_at: '2025-01-01T00:00:00Z',
        },
      ];

      const fieldConfig = /** @type {any} */ ({
        media_libraries: {
          cloudinary: {
            output_filename_only: true,
          },
        },
      });

      const results = parseResults(mockResources, { fieldConfig });

      expect(results).toHaveLength(1);
      // When fileNameOnly is true, downloadURL should be just the filename
      expect(results[0].downloadURL).toBe('image.jpg');
    });

    it('should handle transformations', () => {
      // Test lines 268-270: when hasTransformation is true and fileNameOnly is false
      const mockResources = [
        {
          asset_id: 'asset-123',
          filename: 'sample/image',
          format: 'jpg',
          resource_type: 'image',
          type: 'upload',
          secure_url: 'https://res.cloudinary.com/test-cloud/image/upload/v1/sample/image.jpg',
          bytes: 12345,
          created_at: '2025-01-01T00:00:00Z',
        },
      ];

      const fieldConfig = /** @type {any} */ ({
        media_libraries: {
          cloudinary: {
            use_transformations: true,
            config: {
              default_transformations: [[{ width: 400, crop: 'scale' }]],
            },
          },
        },
      });

      const results = parseResults(mockResources, { fieldConfig });

      expect(results).toHaveLength(1);
      // When hasTransformation is true, downloadURL should include transformation
      expect(results[0].downloadURL).toContain('w_400,c_scale');
    });

    it('should handle library options fallback', () => {
      // Test line 248: when getLibraryOptions(fieldConfig) returns undefined
      // Should fall back to getLibraryOptions() which returns the global config
      const mockResources = [
        {
          asset_id: 'asset-fallback',
          filename: 'sample/image',
          format: 'jpg',
          resource_type: 'image',
          type: 'upload',
          secure_url: 'https://res.cloudinary.com/test-cloud/image/upload/v1/sample/image.jpg',
          bytes: 12345,
          created_at: '2025-01-01T00:00:00Z',
        },
      ];

      // Call with undefined fieldConfig - should use global config
      const results = parseResults(mockResources, { fieldConfig: undefined });

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('asset-fallback');
    });

    it('should handle empty library options', () => {
      // Test line 248: when both getLibraryOptions(fieldConfig) and getLibraryOptions()
      // return undefined, should fall back to empty object {}
      vi.mocked(get).mockReturnValue({}); // No cloudinary config

      const mockResources = [
        {
          asset_id: 'asset-empty',
          filename: 'sample/image',
          format: 'jpg',
          resource_type: 'image',
          type: 'upload',
          secure_url: 'https://res.cloudinary.com/test-cloud/image/upload/v1/sample/image.jpg',
          bytes: 12345,
          created_at: '2025-01-01T00:00:00Z',
        },
      ];

      const results = parseResults(mockResources);

      expect(results).toHaveLength(1);
      // Should use default values (fileNameOnly=false, useTransformations=true)
      expect(results[0].downloadURL).toBe(
        'https://res.cloudinary.com/test-cloud/image/upload/v1/sample/image.jpg',
      );
    });
  });

  describe('list', () => {
    it('should fetch resources successfully', async () => {
      const mockResponse = {
        resources: [
          {
            asset_id: 'asset-sample',
            filename: 'sample/image',
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
        expect.stringContaining(
          `https://api.cloudinary.com/v1_1/${mockCloudName}/resources/search`,
        ),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: expect.stringMatching(/^Basic /),
          }),
        }),
      );
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('asset-sample');
    });

    it('should handle pagination', async () => {
      const mockResponsePage1 = {
        resources: [
          {
            asset_id: 'asset-img1',
            filename: 'img1',
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
            asset_id: 'asset-img2',
            filename: 'img2',
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
      expect(results[0].id).toBe('asset-img1');
      expect(results[1].id).toBe('asset-img2');
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

    it('should filter by image kind without expression', async () => {
      const mockResponse = {
        resources: [
          {
            asset_id: 'asset-img',
            filename: 'image',
            format: 'jpg',
            resource_type: 'image',
            type: 'upload',
            secure_url: 'https://res.cloudinary.com/test-cloud/image/upload/v1/image.jpg',
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

      const results = await list({ kind: 'image', apiKey: mockApiSecret });

      expect(fetch).toHaveBeenCalledTimes(1);

      const fetchCall = vi.mocked(fetch).mock.calls[0];

      if (!fetchCall[0]) {
        throw new Error('Fetch call URL is undefined');
      }

      const url = new URL(/** @type {string} */ (fetchCall[0]));
      const expression = url.searchParams.get('expression');

      expect(expression).toBe('resource_type:image');
      expect(results).toHaveLength(1);
      expect(results[0].kind).toBe('image');
    });

    it('should filter by image kind with custom expression', async () => {
      const mockResponse = {
        resources: [
          {
            asset_id: 'asset-special-img',
            filename: 'special-image',
            format: 'png',
            resource_type: 'image',
            type: 'upload',
            secure_url: 'https://res.cloudinary.com/test-cloud/image/upload/v1/special-image.png',
            bytes: 54321,
            created_at: '2025-01-02T00:00:00Z',
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

      const results = await fetchResources(
        { kind: 'image', apiKey: mockApiSecret },
        { expression: 'filename:special*' },
      );

      expect(fetch).toHaveBeenCalledTimes(1);

      const fetchCall = vi.mocked(fetch).mock.calls[0];

      if (!fetchCall[0]) {
        throw new Error('Fetch call URL is undefined');
      }

      const url = new URL(/** @type {string} */ (fetchCall[0]));
      const expression = url.searchParams.get('expression');

      expect(expression).toBe('(filename:special*) AND resource_type:image');
      expect(results).toHaveLength(1);
      expect(results[0].kind).toBe('image');
    });

    it('should limit to 10 pages', async () => {
      const mockResponse = {
        resources: [
          {
            asset_id: 'asset-img',
            filename: 'img',
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
            asset_id: 'asset-test-image',
            filename: 'test-image',
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

      if (!fetchCall[0]) {
        throw new Error('Fetch call URL is undefined');
      }

      const url = new URL(/** @type {string} */ (fetchCall[0]));
      const expression = url.searchParams.get('expression');

      expect(expression).toContain('test');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('asset-test-image');
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

      if (!fetchCall[0]) {
        throw new Error('Fetch call URL is undefined');
      }

      const url = new URL(/** @type {string} */ (fetchCall[0]));
      const expression = url.searchParams.get('expression');

      expect(expression).toBe('public_id:*my-search* OR filename:*my-search*');
    });

    it('should handle pagination during search', async () => {
      const mockResponsePage1 = {
        resources: [
          {
            asset_id: 'asset-result1',
            filename: 'result1',
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
            asset_id: 'asset-result2',
            filename: 'result2',
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
      expect(results[0].id).toBe('asset-result1');
      expect(results[1].id).toBe('asset-result2');
    });
  });

  describe('upload', () => {
    it('should upload a single file successfully', async () => {
      const mockFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });

      const mockResponse = {
        asset_id: 'asset-uploaded-test',
        filename: 'uploaded/test',
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
      expect(results[0].id).toBe('asset-uploaded-test');
      expect(results[0].fileName).toBe('test.jpg');
    });

    it('should upload multiple files successfully', async () => {
      const mockFile1 = new File(['content1'], 'test1.jpg', { type: 'image/jpeg' });
      const mockFile2 = new File(['content2'], 'test2.png', { type: 'image/png' });

      const mockResponse1 = {
        asset_id: 'asset-uploaded-test1',
        filename: 'uploaded/test1',
        format: 'jpg',
        resource_type: 'image',
        type: 'upload',
        secure_url: 'https://res.cloudinary.com/test-cloud/image/upload/v1/uploaded/test1.jpg',
        bytes: 8,
        created_at: '2025-01-01T00:00:00Z',
      };

      const mockResponse2 = {
        asset_id: 'asset-uploaded-test2',
        filename: 'uploaded/test2',
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
      expect(results[0].id).toBe('asset-uploaded-test1');
      expect(results[1].id).toBe('asset-uploaded-test2');
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
