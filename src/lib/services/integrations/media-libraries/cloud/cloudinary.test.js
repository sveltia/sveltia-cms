import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { cmsConfig } from '$lib/services/config/state';

import cloudinaryService, {
  getCloudConfig,
  getLibraryOptions,
  getMergedLibraryOptions,
  isAssetURL,
  isEnabled,
  optionCacheMap,
} from './cloudinary';

// Mock dependencies while preserving the real writable implementation used by the module.
vi.mock('$lib/services/config/state', () => ({
  cmsConfig: { current: undefined },
}));

describe('integrations/media-libraries/cloud/cloudinary', () => {
  const mockCloudName = 'test-cloud';
  const mockApiKey = '123456789012345';

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock the cmsConfig to return cloudinary config
    cmsConfig.current = /** @type {any} */ ({
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
      // eslint-disable-next-line import-x/no-named-as-default-member
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
    });

    it('should return empty object when config is missing', () => {
      cmsConfig.current = /** @type {any} */ ({});

      const config = getCloudConfig();

      expect(config).toEqual({});
    });

    it('should return empty object when cloudinary config is missing', () => {
      cmsConfig.current = /** @type {any} */ ({
        media_libraries: {},
      });

      const config = getCloudConfig();

      expect(config).toEqual({});
    });

    it('should support legacy media_library config', () => {
      cmsConfig.current = /** @type {any} */ ({
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

  describe('getCloudConfig with a field configuration', () => {
    it('should merge the field-level config over the site-level one', () => {
      const fieldConfig = /** @type {any} */ ({
        widget: 'image',
        media_libraries: { cloudinary: { config: { cloud_name: 'field-cloud' } } },
      });

      expect(getCloudConfig(fieldConfig)).toEqual({
        cloudName: 'field-cloud',
        apiKey: mockApiKey,
      });
    });

    it('should inherit the site-level credentials', () => {
      const fieldConfig = /** @type {any} */ ({
        widget: 'image',
        media_libraries: { cloudinary: { output_filename_only: true } },
      });

      expect(getCloudConfig(fieldConfig)).toEqual({
        cloudName: mockCloudName,
        apiKey: mockApiKey,
      });
    });

    it('should return empty object when the field disables Cloudinary', () => {
      const fieldConfig = /** @type {any} */ ({
        widget: 'image',
        media_libraries: { cloudinary: false },
      });

      expect(getCloudConfig(fieldConfig)).toEqual({});
    });
  });

  describe('getLibraryOptions', () => {
    it('should return cloudinary library options from media_libraries', () => {
      const options = getLibraryOptions();

      expect(options).toBeDefined();
      expect(/** @type {any} */ (options)?.config?.cloud_name).toBe(mockCloudName);
      expect(/** @type {any} */ (options)?.config?.api_key).toBe(mockApiKey);
    });

    it('should return undefined when config is missing', () => {
      cmsConfig.current = /** @type {any} */ ({});

      const options = getLibraryOptions();

      expect(options).toBeUndefined();
    });

    it('should support legacy media_library config', () => {
      cmsConfig.current = /** @type {any} */ ({
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
      expect(/** @type {any} */ (options)?.config?.cloud_name).toBe('legacy-cloud');
    });

    it('should return undefined for non-cloudinary media_library', () => {
      cmsConfig.current = /** @type {any} */ ({
        media_library: {
          name: 'other-service',
          config: {},
        },
      });

      const options = getLibraryOptions();

      expect(options).toBeUndefined();
    });

    it('should accept media_library config without name when site config has cloudinary media_library', () => {
      cmsConfig.current = /** @type {any} */ ({
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
      expect(/** @type {any} */ (options)?.config?.cloud_name).toBe('field-cloud');
    });

    it('should not accept media_library config without name when site config uses another library', () => {
      cmsConfig.current = /** @type {any} */ ({ media_library: { name: 'uploadcare' } });

      const fieldConfig = /** @type {any} */ ({
        media_library: { config: { cloud_name: 'field-cloud' } },
      });

      expect(getLibraryOptions(fieldConfig)).toBeUndefined();
    });

    it('should return undefined when no config is available at all', () => {
      cmsConfig.current = undefined;

      expect(getLibraryOptions()).toBeUndefined();
    });
  });

  describe('getMergedLibraryOptions', () => {
    beforeEach(() => {
      // Clear the cache before each test
      optionCacheMap.clear();
    });

    it('should return site config when field config has no cloudinary options', () => {
      cmsConfig.current = /** @type {any} */ ({
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
      cmsConfig.current = /** @type {any} */ ({
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

    it('should inherit the site-level credentials in a field-level `media_libraries` option', () => {
      const fieldConfig = /** @type {any} */ ({
        widget: 'image',
        media_libraries: { cloudinary: { config: { multiple: true } } },
      });

      expect(getMergedLibraryOptions(fieldConfig)).toEqual({
        config: { cloud_name: mockCloudName, api_key: mockApiKey, multiple: true },
      });
    });

    it('should return empty options when the field disables Cloudinary', () => {
      const fieldConfig = /** @type {any} */ ({
        widget: 'image',
        media_libraries: { cloudinary: false },
      });

      expect(getMergedLibraryOptions(fieldConfig)).toEqual({ config: {} });
    });

    it('should handle undefined site config', () => {
      cmsConfig.current = /** @type {any} */ ({});

      const merged = getMergedLibraryOptions(/** @type {any} */ ({}));

      expect(merged.config).toEqual({});
    });

    it('should use site config when field config is undefined', () => {
      cmsConfig.current = /** @type {any} */ ({
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
      cmsConfig.current = /** @type {any} */ ({
        media_libraries: {
          cloudinary: {
            label: 'Site Label',
            config: {
              cloud_name: 'site-cloud',
            },
          },
        },
      });

      const fieldConfig = /** @type {any} */ ({});
      const merged = getMergedLibraryOptions(fieldConfig);

      expect(merged.config?.cloud_name).toBe('site-cloud');
    });

    it('should deeply merge config objects', () => {
      cmsConfig.current = /** @type {any} */ ({
        media_libraries: {
          cloudinary: {
            config: {
              cloud_name: 'site-cloud',
              api_key: 'site-key',
              transform_a: 'site-value',
            },
          },
        },
      });

      const merged = getMergedLibraryOptions(/** @type {any} */ ({}));

      expect(merged.config?.cloud_name).toBe('site-cloud');
      expect(merged.config?.api_key).toBe('site-key');
      expect(merged.config?.transform_a).toBe('site-value');
    });

    it('should cache results for identical field configs', async () => {
      cmsConfig.current = /** @type {any} */ ({
        media_libraries: {
          cloudinary: {
            config: {
              cloud_name: 'site-cloud',
              api_key: 'site-key',
            },
          },
        },
      });

      const fieldConfig = /** @type {any} */ ({ type: 'image', options: { width: 400 } });
      const result1 = getMergedLibraryOptions(fieldConfig);
      const result2 = getMergedLibraryOptions(fieldConfig);

      // Both results should be identical (same reference due to cache)
      expect(result1).toBe(result2);
      expect(result1.config?.cloud_name).toBe('site-cloud');
    });

    it('should use "global" cache key for undefined field config', () => {
      cmsConfig.current = /** @type {any} */ ({
        media_libraries: {
          cloudinary: {
            config: {
              cloud_name: 'site-cloud',
              api_key: 'site-key',
            },
          },
        },
      });

      const result1 = getMergedLibraryOptions(undefined);
      const result2 = getMergedLibraryOptions(undefined);

      // Both results should be the same cached instance
      expect(result1).toBe(result2);
    });

    it('should create separate cache entries for different field configs', () => {
      cmsConfig.current = /** @type {any} */ ({
        media_libraries: {
          cloudinary: {
            config: {
              cloud_name: 'site-cloud',
              api_key: 'site-key',
            },
          },
        },
      });

      const fieldConfig1 = /** @type {any} */ ({ type: 'image', options: { width: 400 } });
      const fieldConfig2 = /** @type {any} */ ({ type: 'video', options: { width: 800 } });
      const result1 = getMergedLibraryOptions(fieldConfig1);
      const result2 = getMergedLibraryOptions(fieldConfig2);

      // Results should be different instances (different cache keys)
      expect(result1).not.toBe(result2);
      expect(result1.config?.cloud_name).toBe('site-cloud');
      expect(result2.config?.cloud_name).toBe('site-cloud');
    });

    it('should cache based on JSON stringified field config', () => {
      cmsConfig.current = /** @type {any} */ ({
        media_libraries: {
          cloudinary: {
            config: {
              cloud_name: 'site-cloud',
              api_key: 'site-key',
            },
          },
        },
      });

      // Two different objects with same properties should use same cache
      const fieldConfig1 = /** @type {any} */ ({ type: 'image', width: 400 });
      const fieldConfig2 = /** @type {any} */ ({ type: 'image', width: 400 });
      const result1 = getMergedLibraryOptions(fieldConfig1);
      const result2 = getMergedLibraryOptions(fieldConfig2);

      // Should use same cache entry
      expect(result1).toBe(result2);
    });
  });

  describe('isAssetURL', () => {
    it('should match the product environment on the Cloudinary CDN', () => {
      const { cloudName } = getCloudConfig();

      expect(cloudinaryService).toMatchObject({ isAssetURL });
      expect(isAssetURL(`https://res.cloudinary.com/${cloudName}/image/upload/a.jpg`)).toBe(true);
      expect(isAssetURL('https://res.cloudinary.com/other/image/upload/a.jpg')).toBe(false);
    });

    it('should be false when the service is not configured', () => {
      cmsConfig.current = /** @type {any} */ ({});
      expect(isAssetURL('https://res.cloudinary.com/demo/image/upload/a.jpg')).toBe(false);
    });
  });

  describe('isEnabled', () => {
    it('should return true when cloud name and API key are configured', () => {
      expect(isEnabled()).toBe(true);
    });

    it('should return false when config is missing', () => {
      cmsConfig.current = /** @type {any} */ ({});

      expect(isEnabled()).toBe(false);
    });

    it('should return false when cloud name is missing', () => {
      cmsConfig.current = /** @type {any} */ ({
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
      cmsConfig.current = /** @type {any} */ ({
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

    it('should return true when field-level config is present', () => {
      cmsConfig.current = /** @type {any} */ ({});

      expect(
        isEnabled(
          /** @type {any} */ ({
            widget: 'image',
            media_libraries: {
              cloudinary: {
                config: {
                  cloud_name: mockCloudName,
                  api_key: mockApiKey,
                },
              },
            },
          }),
        ),
      ).toBe(true);
    });

    it('should inherit the site-level credentials when the field-level config has none', () => {
      expect(
        isEnabled(
          /** @type {any} */ ({
            widget: 'image',
            media_libraries: { cloudinary: { config: { default_transformations: [] } } },
          }),
        ),
      ).toBe(true);
    });

    it('should inherit the site-level credentials in a legacy field-level option', () => {
      cmsConfig.current = /** @type {any} */ ({
        media_library: {
          name: 'cloudinary',
          config: { cloud_name: mockCloudName, api_key: mockApiKey },
        },
      });

      expect(
        isEnabled(
          /** @type {any} */ ({ widget: 'image', media_library: { config: { multiple: true } } }),
        ),
      ).toBe(true);
    });

    it('should return false when the field disables Cloudinary', () => {
      expect(
        isEnabled(/** @type {any} */ ({ widget: 'image', media_libraries: { cloudinary: false } })),
      ).toBe(false);
    });

    it('should return false when field-level config has missing credentials', () => {
      cmsConfig.current = /** @type {any} */ ({});

      expect(
        isEnabled(
          /** @type {any} */ ({
            widget: 'image',
            media_libraries: {
              cloudinary: {
                config: {},
              },
            },
          }),
        ),
      ).toBe(false);
    });
  });
});
