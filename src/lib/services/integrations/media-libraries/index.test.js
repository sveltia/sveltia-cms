import { beforeEach, describe, expect, it, vi } from 'vitest';

import { cmsConfig } from '$lib/services/config';

import { getMediaLibraryOptions } from '.';

// Mock all dependencies
vi.mock('$lib/services/config', () => ({
  cmsConfig: { current: undefined },
}));

describe('integrations/media-libraries', () => {
  /** @type {any} */
  let mockCmsConfig;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock site config
    mockCmsConfig = {
      media_library: {
        name: 'default',
        config: {
          max_file_size: 1024000,
          slugify_filename: true,
          transformations: {
            jpeg: { format: 'webp', quality: 80 },
          },
        },
      },
      media_libraries: {
        default: {
          config: {
            max_file_size: 2048000,
            slugify_filename: false,
          },
        },
        stock_assets: {
          providers: ['unsplash', 'pixabay'],
        },
      },
    };

    cmsConfig.current = mockCmsConfig;
  });

  describe('getMediaLibraryOptions', () => {
    it('should return field-level media_libraries config with highest priority', () => {
      const fieldConfig = /** @type {any} */ ({
        media_libraries: {
          default: { config: { max_file_size: 500000 } },
          custom: { config: { slugify_filename: true } },
        },
        media_library: { config: { max_file_size: 100000 } },
      });

      const result = getMediaLibraryOptions({ libraryName: 'default', fieldConfig });

      expect(result).toEqual({ config: { max_file_size: 500000 } });
    });

    it('should return field-level media_library config when media_libraries not available', () => {
      const fieldConfig = /** @type {any} */ ({
        media_library: {
          name: 'default',
          config: { slugify_filename: true },
        },
      });

      const result = getMediaLibraryOptions({ libraryName: 'default', fieldConfig });

      expect(result).toEqual({
        name: 'default',
        config: { slugify_filename: true },
      });
    });

    it('should match field media_library when names match explicitly and site config also matches', async () => {
      // Site config must also have the matching library name for Priority 2 to apply
      cmsConfig.current = /** @type {any} */ ({
        media_library: { name: 'custom' },
      });

      const fieldConfig = /** @type {any} */ ({
        media_library: {
          name: 'custom',
          config: { max_file_size: 200000 },
        },
      });

      const result = getMediaLibraryOptions({
        libraryName: /** @type {any} */ ('custom'),
        fieldConfig,
      });

      expect(result).toEqual({
        name: 'custom',
        config: { max_file_size: 200000 },
      });
    });

    it('should not match field media_library when field name matches but site config does not match', async () => {
      // Site config has different library name
      cmsConfig.current = /** @type {any} */ ({
        media_library: { name: 'default' },
      });

      const fieldConfig = /** @type {any} */ ({
        media_library: {
          name: 'custom',
          config: { max_file_size: 200000 },
        },
      });

      // Should not match because site config doesn't match requested library
      const result = getMediaLibraryOptions({
        libraryName: /** @type {any} */ ('custom'),
        fieldConfig,
      });

      expect(result).toEqual({});
    });

    it('should match field media_library when site config is undefined (defaults to "default") and requesting default', async () => {
      // Site config has no media_library name (will default to 'default')
      cmsConfig.current = /** @type {any} */ ({});

      const fieldConfig = /** @type {any} */ ({
        media_library: {
          name: 'default',
          config: { max_file_size: 300000 },
        },
      });

      const result = getMediaLibraryOptions({ libraryName: 'default', fieldConfig });

      expect(result).toEqual({
        name: 'default',
        config: { max_file_size: 300000 },
      });
    });

    it('should match field media_library when field name is undefined and site/library names match', async () => {
      cmsConfig.current = /** @type {any} */ ({
        media_library: { name: 'default' },
      });

      const fieldConfig = /** @type {any} */ ({
        media_library: {
          config: { slugify_filename: true },
        },
      });

      const result = getMediaLibraryOptions({ libraryName: 'default', fieldConfig });

      expect(result).toEqual({
        config: { slugify_filename: true },
      });
    });

    it('should match field media_library when site name defaults to "default" and requesting default', async () => {
      cmsConfig.current = /** @type {any} */ ({});

      const fieldConfig = /** @type {any} */ ({
        media_library: {
          config: { max_file_size: 300000 },
        },
      });

      const result = getMediaLibraryOptions({ libraryName: 'default', fieldConfig });

      expect(result).toEqual({
        config: { max_file_size: 300000 },
      });
    });

    it('should not match field media_library when site defaults to "default" but field name is different', async () => {
      cmsConfig.current = /** @type {any} */ ({}); // Empty site config

      const fieldConfig = /** @type {any} */ ({
        media_library: {
          name: 'custom',
          config: { slugify_filename: true },
        },
      });

      const result = getMediaLibraryOptions({ libraryName: 'default', fieldConfig });

      expect(result).toEqual({});
    });

    it('should match field media_library when field name is undefined and site has explicit non-default name', async () => {
      cmsConfig.current = /** @type {any} */ ({
        media_library: { name: 'custom' },
      });

      const fieldConfig = /** @type {any} */ ({
        media_library: {
          config: { max_file_size: 400000 },
        },
      });

      const result = getMediaLibraryOptions({
        libraryName: /** @type {any} */ ('custom'),
        fieldConfig,
      });

      expect(result).toEqual({
        config: { max_file_size: 400000 },
      });
    });

    it('should fallback to site-level media_libraries config', async () => {
      cmsConfig.current = /** @type {any} */ ({
        media_libraries: {
          default: { config: { max_file_size: 1024000 } },
          custom: { config: { slugify_filename: true } },
        },
      });

      const result = getMediaLibraryOptions({ libraryName: /** @type {any} */ ('custom') });

      expect(result).toEqual({ config: { slugify_filename: true } });
    });

    it('should fallback to site-level media_library config when names match', async () => {
      cmsConfig.current = /** @type {any} */ ({
        media_library: {
          name: 'default',
          config: { transformations: { jpeg: { format: 'webp' } } },
        },
      });

      const result = getMediaLibraryOptions({ libraryName: 'default' });

      expect(result).toEqual({
        name: 'default',
        config: { transformations: { jpeg: { format: 'webp' } } },
      });
    });

    it('should not match site media_library when names do not match', async () => {
      cmsConfig.current = /** @type {any} */ ({
        media_library: {
          name: 'custom',
          config: { slugify_filename: true },
        },
      });

      const result = getMediaLibraryOptions({ libraryName: 'default' });

      expect(result).toEqual({});
    });

    it('should return empty object when no config is found', async () => {
      cmsConfig.current = /** @type {any} */ ({});

      const result = getMediaLibraryOptions({ libraryName: /** @type {any} */ ('nonexistent') });

      expect(result).toEqual({});
    });

    it('should default libraryName to "default" when not provided', () => {
      const fieldConfig = /** @type {any} */ ({
        media_libraries: {
          default: { config: { max_file_size: 500000 } },
        },
      });

      const result = getMediaLibraryOptions({ fieldConfig });

      expect(result).toEqual({ config: { max_file_size: 500000 } });
    });

    it('should work with no parameters provided', async () => {
      cmsConfig.current = /** @type {any} */ ({
        media_libraries: {
          default: { config: { slugify_filename: false } },
        },
      });

      const result = getMediaLibraryOptions();

      expect(result).toEqual({ config: { slugify_filename: false } });
    });

    it('should handle complex priority scenario with all config levels', () => {
      // This test ensures field.media_libraries has highest priority
      const fieldConfig = /** @type {any} */ ({
        media_libraries: {
          default: { config: { max_file_size: 1000 } }, // Should win
        },
        media_library: {
          name: 'default',
          config: { max_file_size: 2000 },
        },
      });

      // Site config should be ignored due to higher priority field config
      mockCmsConfig.media_libraries = {
        default: { config: { max_file_size: 3000 } },
      };
      mockCmsConfig.media_library = {
        name: 'default',
        config: { max_file_size: 4000 },
      };

      const result = getMediaLibraryOptions({ libraryName: 'default', fieldConfig });

      expect(result).toEqual({ config: { max_file_size: 1000 } });
    });

    it('should not match field media_library when site defaults to "default" but requesting different library', async () => {
      // Site config has no media_library name (will default to 'default')
      cmsConfig.current = /** @type {any} */ ({});

      // Field config has no media_library name
      const fieldConfig = /** @type {any} */ ({
        media_library: {
          config: { max_file_size: 300000 },
        },
      });

      // Request a non-'default' library name - should not match because site defaults to 'default'
      const result = getMediaLibraryOptions({
        libraryName: /** @type {any} */ ('custom'),
        fieldConfig,
      });

      expect(result).toEqual({});
    });

    it('should match field media_library when field name is undefined and site name matches requested library', async () => {
      // Site config has a library name that matches our request
      cmsConfig.current = /** @type {any} */ ({
        media_library: { name: 'custom' },
      });

      const fieldConfig = /** @type {any} */ ({
        media_library: {
          config: { max_file_size: 400000 },
        },
      });

      // Should match because field name is undefined and site name matches requested library
      const result = getMediaLibraryOptions({
        libraryName: /** @type {any} */ ('custom'),
        fieldConfig,
      });

      expect(result).toEqual({
        config: { max_file_size: 400000 },
      });
    });

    it('should not match when site name is undefined (defaults to "default") but requesting different library', async () => {
      // Site config has no media_library name (will default to 'default')
      cmsConfig.current = /** @type {any} */ ({
        media_library: { some_other_config: true }, // No 'name' property
      });

      const fieldConfig = /** @type {any} */ ({
        media_library: {
          config: { max_file_size: 500000 },
          // No 'name' property, so fieldLibName is undefined
        },
      });

      // Request a non-'default' library name - should not match because site defaults to 'default'
      const result = getMediaLibraryOptions({
        libraryName: /** @type {any} */ ('custom'),
        fieldConfig,
      });

      expect(result).toEqual({});
    });

    it('should match field media_library when site explicitly sets name to "default" and field name is undefined', async () => {
      // Site config explicitly sets name to 'default'
      cmsConfig.current = /** @type {any} */ ({
        media_library: { name: 'default' },
      });

      const fieldConfig = /** @type {any} */ ({
        media_library: {
          config: { max_file_size: 600000 },
          // No 'name' property, so fieldLibName is undefined
        },
      });

      // Request 'default' - should match because site name is 'default' and field name is undefined
      const result = getMediaLibraryOptions({ libraryName: 'default', fieldConfig });

      expect(result).toEqual({
        config: { max_file_size: 600000 },
      });
    });

    it('should return empty object when field-level media_libraries entry is null', () => {
      const fieldConfig = /** @type {any} */ ({
        media_libraries: {
          default: null,
        },
      });

      const result = getMediaLibraryOptions({ libraryName: 'default', fieldConfig });

      expect(result).toEqual({});
    });

    it('should return empty object when site-level media_libraries entry is null', async () => {
      cmsConfig.current = /** @type {any} */ ({
        media_libraries: {
          stock_assets: null,
        },
      });

      const result = getMediaLibraryOptions({ libraryName: /** @type {any} */ ('stock_assets') });

      expect(result).toEqual({});
    });

    it('should return false when field-level media_libraries explicitly disables a library', () => {
      const fieldConfig = /** @type {any} */ ({
        media_libraries: {
          default: false,
        },
      });

      const result = getMediaLibraryOptions({ libraryName: 'default', fieldConfig });

      expect(result).toBe(false);
    });

    it('should return false when site-level media_libraries explicitly disables a library', async () => {
      cmsConfig.current = /** @type {any} */ ({
        media_libraries: {
          stock_assets: false,
        },
      });

      const result = getMediaLibraryOptions({ libraryName: /** @type {any} */ ('stock_assets') });

      expect(result).toBe(false);
    });

    it('should respect field-level false even when site-level has config', async () => {
      cmsConfig.current = /** @type {any} */ ({
        media_libraries: {
          default: { config: { max_file_size: 2048000 } },
        },
      });

      const fieldConfig = /** @type {any} */ ({
        media_libraries: {
          default: false,
        },
      });

      const result = getMediaLibraryOptions({ libraryName: 'default', fieldConfig });

      expect(result).toBe(false);
    });

    it('should fall through to site config when field media_libraries does not include the library', async () => {
      cmsConfig.current = /** @type {any} */ ({
        media_libraries: {
          cloudflare_r2: { access_key_id: 'key', bucket: 'bucket', account_id: 'id' },
        },
      });

      const fieldConfig = /** @type {any} */ ({
        media_libraries: {
          default: false,
        },
      });

      const result = getMediaLibraryOptions({
        libraryName: /** @type {any} */ ('cloudflare_r2'),
        fieldConfig,
      });

      expect(result).toEqual({ access_key_id: 'key', bucket: 'bucket', account_id: 'id' });
    });

    describe('all (shared) option merging', () => {
      it('should merge site-level all options into the default library config', async () => {
        cmsConfig.current = /** @type {any} */ ({
          media_libraries: {
            all: { slugify_filename: true, max_file_size: 1024000 },
            default: { config: { multiple: false } },
          },
        });

        const result = getMediaLibraryOptions({ libraryName: 'default' });

        expect(result).toEqual({
          config: { slugify_filename: true, max_file_size: 1024000, multiple: false },
        });
      });

      it('should let library-specific config override all options', async () => {
        cmsConfig.current = /** @type {any} */ ({
          media_libraries: {
            all: { slugify_filename: true, max_file_size: 500000 },
            default: { config: { slugify_filename: false } },
          },
        });

        const result = getMediaLibraryOptions({ libraryName: 'default' });

        expect(result).toEqual({
          config: { slugify_filename: false, max_file_size: 500000 },
        });
      });

      it('should merge field-level all options on top of site-level all options', async () => {
        cmsConfig.current = /** @type {any} */ ({
          media_libraries: {
            all: { slugify_filename: true, max_file_size: 500000 },
          },
        });

        const fieldConfig = /** @type {any} */ ({
          media_libraries: {
            all: { max_file_size: 200000 },
          },
        });

        const result = getMediaLibraryOptions({ libraryName: 'default', fieldConfig });

        expect(result).toEqual({
          config: { slugify_filename: true, max_file_size: 200000 },
        });
      });

      it('should apply all options when no library-specific config exists', async () => {
        cmsConfig.current = /** @type {any} */ ({
          media_libraries: {
            all: { slugify_filename: true },
          },
        });

        const result = getMediaLibraryOptions({ libraryName: 'default' });

        expect(result).toEqual({ config: { slugify_filename: true } });
      });

      it('should not apply all options to non-default libraries', async () => {
        cmsConfig.current = /** @type {any} */ ({
          media_libraries: {
            all: { slugify_filename: true },
            stock_assets: { providers: ['unsplash'] },
          },
        });

        const result = getMediaLibraryOptions({ libraryName: 'stock_assets' });

        expect(result).toEqual({ providers: ['unsplash'] });
      });

      it('should apply field-level all options even without site-level all options', () => {
        const fieldConfig = /** @type {any} */ ({
          media_libraries: {
            all: { slugify_filename: true },
            default: { config: { multiple: true } },
          },
        });

        const result = getMediaLibraryOptions({ libraryName: 'default', fieldConfig });

        expect(result).toEqual({
          config: { slugify_filename: true, multiple: true },
        });
      });

      it('should not apply all options to the default library when it is explicitly disabled', () => {
        const fieldConfig = /** @type {any} */ ({
          media_libraries: {
            all: { slugify_filename: true },
            default: false,
          },
        });

        const result = getMediaLibraryOptions({ libraryName: 'default', fieldConfig });

        expect(result).toBe(false);
      });
    });
  });
});
