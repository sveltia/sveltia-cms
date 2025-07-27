import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getMediaLibraryOptions } from './index';

// Mock all dependencies
vi.mock('svelte/store', () => ({
  get: vi.fn(),
  writable: vi.fn(() => ({ subscribe: vi.fn(), set: vi.fn(), update: vi.fn() })),
  derived: vi.fn(() => ({ subscribe: vi.fn() })),
}));
vi.mock('$lib/services/config', () => ({
  siteConfig: {
    subscribe: vi.fn(),
    _mockValue: 'siteConfig',
  },
}));

describe('integrations/media-libraries', () => {
  /** @type {any} */
  let mockSiteConfig;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock site config
    mockSiteConfig = {
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

    // Setup get mock
    const { get } = await import('svelte/store');
    const getMock = vi.mocked(get);

    getMock.mockImplementation((store) => {
      if (store && typeof store === 'object' && '_mockValue' in store) {
        if (store._mockValue === 'siteConfig') return mockSiteConfig;
      }

      return undefined;
    });
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
      const { get } = await import('svelte/store');
      const getMock = vi.mocked(get);

      // Site config must also have the matching library name for Priority 2 to apply
      getMock.mockImplementation(() => ({
        media_library: { name: 'custom' },
      }));

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
      const { get } = await import('svelte/store');
      const getMock = vi.mocked(get);

      // Site config has different library name
      getMock.mockImplementation(() => ({
        media_library: { name: 'default' },
      }));

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
      const { get } = await import('svelte/store');
      const getMock = vi.mocked(get);

      // Site config has no media_library name (will default to 'default')
      getMock.mockImplementation(() => ({}));

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
      const { get } = await import('svelte/store');
      const getMock = vi.mocked(get);

      getMock.mockImplementation(() => ({
        media_library: { name: 'default' },
      }));

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
      const { get } = await import('svelte/store');
      const getMock = vi.mocked(get);

      getMock.mockImplementation(() => ({}));

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
      const { get } = await import('svelte/store');
      const getMock = vi.mocked(get);

      getMock.mockImplementation(() => ({})); // Empty site config

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
      const { get } = await import('svelte/store');
      const getMock = vi.mocked(get);

      getMock.mockImplementation(() => ({
        media_library: { name: 'custom' },
      }));

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
      const { get } = await import('svelte/store');
      const getMock = vi.mocked(get);

      getMock.mockImplementation(() => ({
        media_libraries: {
          default: { config: { max_file_size: 1024000 } },
          custom: { config: { slugify_filename: true } },
        },
      }));

      const result = getMediaLibraryOptions({ libraryName: /** @type {any} */ ('custom') });

      expect(result).toEqual({ config: { slugify_filename: true } });
    });

    it('should fallback to site-level media_library config when names match', async () => {
      const { get } = await import('svelte/store');
      const getMock = vi.mocked(get);

      getMock.mockImplementation(() => ({
        media_library: {
          name: 'default',
          config: { transformations: { jpeg: { format: 'webp' } } },
        },
      }));

      const result = getMediaLibraryOptions({ libraryName: 'default' });

      expect(result).toEqual({
        name: 'default',
        config: { transformations: { jpeg: { format: 'webp' } } },
      });
    });

    it('should not match site media_library when names do not match', async () => {
      const { get } = await import('svelte/store');
      const getMock = vi.mocked(get);

      getMock.mockImplementation(() => ({
        media_library: {
          name: 'custom',
          config: { slugify_filename: true },
        },
      }));

      const result = getMediaLibraryOptions({ libraryName: 'default' });

      expect(result).toEqual({});
    });

    it('should return empty object when no config is found', async () => {
      const { get } = await import('svelte/store');
      const getMock = vi.mocked(get);

      getMock.mockImplementation(() => ({}));

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
      const { get } = await import('svelte/store');
      const getMock = vi.mocked(get);

      getMock.mockImplementation(() => ({
        media_libraries: {
          default: { config: { slugify_filename: false } },
        },
      }));

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
      mockSiteConfig.media_libraries = {
        default: { config: { max_file_size: 3000 } },
      };
      mockSiteConfig.media_library = {
        name: 'default',
        config: { max_file_size: 4000 },
      };

      const result = getMediaLibraryOptions({ libraryName: 'default', fieldConfig });

      expect(result).toEqual({ config: { max_file_size: 1000 } });
    });

    it('should not match field media_library when site defaults to "default" but requesting different library', async () => {
      const { get } = await import('svelte/store');
      const getMock = vi.mocked(get);

      // Site config has no media_library name (will default to 'default')
      getMock.mockImplementation(() => ({}));

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
      const { get } = await import('svelte/store');
      const getMock = vi.mocked(get);

      // Site config has a library name that matches our request
      getMock.mockImplementation(() => ({
        media_library: { name: 'custom' },
      }));

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
      const { get } = await import('svelte/store');
      const getMock = vi.mocked(get);

      // Site config has no media_library name (will default to 'default')
      getMock.mockImplementation(() => ({
        media_library: { some_other_config: true }, // No 'name' property
      }));

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

    it('should match when site explicitly sets name to "default" and field name is undefined', async () => {
      const { get } = await import('svelte/store');
      const getMock = vi.mocked(get);

      // Site config explicitly sets name to 'default'
      getMock.mockImplementation(() => ({
        media_library: { name: 'default' },
      }));

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
  });
});
