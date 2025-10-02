import { beforeEach, describe, expect, it, vi } from 'vitest';

import { hasMultipleInMediaLibraries, hasMultipleInMediaLibrary, isMultiple } from './shared';

// Mock all dependencies
vi.mock('svelte/store', () => ({
  get: vi.fn(),
}));

vi.mock('$lib/services/config', () => ({
  siteConfig: {
    _mockValue: 'siteConfig',
  },
}));

describe('integrations/media-libraries/shared', () => {
  /** @type {any} */
  let mockSiteConfig;
  /** @type {any} */
  let getMock;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Default mock site config
    mockSiteConfig = {};

    // Setup get mock
    const { get } = await import('svelte/store');

    getMock = vi.mocked(get);

    getMock.mockImplementation((/** @type {any} */ store) => {
      if (store && typeof store === 'object' && '_mockValue' in store) {
        if (store._mockValue === 'siteConfig') return mockSiteConfig;
      }

      return undefined;
    });
  });

  describe('isMultiple', () => {
    it('should return true when fieldConfig.multiple is true', () => {
      const fieldConfig = /** @type {any} */ ({
        multiple: true,
      });

      const result = isMultiple(fieldConfig);

      expect(result).toBe(true);
    });

    it('should return false when fieldConfig.multiple is false', () => {
      const fieldConfig = /** @type {any} */ ({
        multiple: false,
      });

      const result = isMultiple(fieldConfig);

      expect(result).toBe(false);
    });

    it('should check field-level media_libraries when fieldConfig.multiple is undefined', () => {
      const fieldConfig = /** @type {any} */ ({
        media_libraries: {
          default: { config: { multiple: true } },
          custom: { config: { multiple: false } },
        },
      });

      const result = isMultiple(fieldConfig);

      expect(result).toBe(true);
    });

    it('should return false when no media_libraries have multiple: true', () => {
      const fieldConfig = /** @type {any} */ ({
        media_libraries: {
          default: { config: { multiple: false } },
          custom: { config: { multiple: false } },
        },
      });

      const result = isMultiple(fieldConfig);

      expect(result).toBe(false);
    });

    it('should check field-level media_library when media_libraries is undefined', () => {
      const fieldConfig = /** @type {any} */ ({
        media_library: { config: { multiple: true } },
      });

      const result = isMultiple(fieldConfig);

      expect(result).toBe(true);
    });

    it('should return false when field-level media_library.config.multiple is false', () => {
      const fieldConfig = /** @type {any} */ ({
        media_library: { config: { multiple: false } },
      });

      const result = isMultiple(fieldConfig);

      expect(result).toBe(false);
    });

    it('should check site-level media_libraries when field-level options are undefined', () => {
      mockSiteConfig = {
        media_libraries: {
          default: { config: { multiple: true } },
        },
      };

      const fieldConfig = /** @type {any} */ ({});
      const result = isMultiple(fieldConfig);

      expect(result).toBe(true);
    });

    it('should return false when site-level media_libraries have multiple: false', () => {
      mockSiteConfig = {
        media_libraries: {
          default: { config: { multiple: false } },
          custom: { config: { multiple: false } },
        },
      };

      const fieldConfig = /** @type {any} */ ({});
      const result = isMultiple(fieldConfig);

      expect(result).toBe(false);
    });

    it('should check site-level media_library when media_libraries is undefined', () => {
      mockSiteConfig = {
        media_library: { config: { multiple: true } },
      };

      const fieldConfig = /** @type {any} */ ({});
      const result = isMultiple(fieldConfig);

      expect(result).toBe(true);
    });

    it('should return false when site-level media_library.config.multiple is false', () => {
      mockSiteConfig = {
        media_library: { config: { multiple: false } },
      };

      const fieldConfig = /** @type {any} */ ({});
      const result = isMultiple(fieldConfig);

      expect(result).toBe(false);
    });

    it('should return false as default when all options are undefined', () => {
      const fieldConfig = /** @type {any} */ ({});
      const result = isMultiple(fieldConfig);

      expect(result).toBe(false);
    });

    it('should prioritize field-level multiple over media library configs', () => {
      mockSiteConfig = {
        media_libraries: {
          default: { config: { multiple: true } },
        },
        media_library: { config: { multiple: true } },
      };

      const fieldConfig = /** @type {any} */ ({
        multiple: false,
        media_libraries: {
          default: { config: { multiple: true } },
        },
        media_library: { config: { multiple: true } },
      });

      const result = isMultiple(fieldConfig);

      expect(result).toBe(false);
    });

    it('should handle empty media_libraries object', () => {
      const fieldConfig = /** @type {any} */ ({
        media_libraries: {},
      });

      const result = isMultiple(fieldConfig);

      expect(result).toBe(false);
    });

    it('should handle media_library without config', () => {
      const fieldConfig = /** @type {any} */ ({
        media_library: {},
      });

      const result = isMultiple(fieldConfig);

      expect(result).toBe(false);
    });

    it('should handle media_library with config but no multiple property', () => {
      const fieldConfig = /** @type {any} */ ({
        media_library: { config: {} },
      });

      const result = isMultiple(fieldConfig);

      expect(result).toBe(false);
    });

    it('should handle null/undefined media_library', () => {
      const fieldConfig = /** @type {any} */ ({
        media_library: null,
      });

      const result = isMultiple(fieldConfig);

      expect(result).toBe(false);
    });

    it('should handle Stock Asset library without config property', () => {
      const fieldConfig = /** @type {any} */ ({
        media_libraries: {
          stock_assets: { providers: ['unsplash'] }, // No config property
          default: { config: { multiple: true } },
        },
      });

      const result = isMultiple(fieldConfig);

      expect(result).toBe(true);
    });

    it('should handle mixed library types with and without config', () => {
      const fieldConfig = /** @type {any} */ ({
        media_libraries: {
          stock_assets: { providers: ['unsplash'] }, // No config property
          cloudinary: { config: { multiple: false } },
          default: { config: { multiple: true } },
        },
      });

      const result = isMultiple(fieldConfig);

      expect(result).toBe(true);
    });

    it('should follow priority order: field multiple > field media_libraries > field media_library > site media_libraries > site media_library > default', () => {
      mockSiteConfig = {
        media_libraries: {
          default: { config: { multiple: true } },
        },
        media_library: { config: { multiple: true } },
      };

      // Test field media_libraries has priority over site config
      const fieldConfig1 = /** @type {any} */ ({
        media_libraries: {
          default: { config: { multiple: false } },
        },
      });

      expect(isMultiple(fieldConfig1)).toBe(false);

      // Test field media_library has priority over site media_libraries
      const fieldConfig2 = /** @type {any} */ ({
        media_library: { config: { multiple: false } },
      });

      expect(isMultiple(fieldConfig2)).toBe(false);

      // Test site media_libraries has priority over site media_library
      mockSiteConfig = {
        media_libraries: {
          default: { config: { multiple: false } },
        },
        media_library: { config: { multiple: true } },
      };

      const fieldConfig3 = /** @type {any} */ ({});

      expect(isMultiple(fieldConfig3)).toBe(false);
    });

    it('should handle undefined siteConfig', () => {
      getMock.mockReturnValue(undefined);

      const fieldConfig = /** @type {any} */ ({});
      const result = isMultiple(fieldConfig);

      expect(result).toBe(false);
    });

    it('should handle null siteConfig', () => {
      getMock.mockReturnValue(null);

      const fieldConfig = /** @type {any} */ ({});
      const result = isMultiple(fieldConfig);

      expect(result).toBe(false);
    });
  });

  describe('hasMultipleInMediaLibraries', () => {
    it('should return undefined when mediaLibraries is undefined', () => {
      expect(hasMultipleInMediaLibraries(undefined)).toBeUndefined();
    });

    it('should return true when any library has multiple: true', () => {
      const mediaLibraries = /** @type {any} */ ({
        lib1: { config: { multiple: true } },
        lib2: { config: { multiple: false } },
      });

      expect(hasMultipleInMediaLibraries(mediaLibraries)).toBe(true);
    });

    it('should return false when all libraries have multiple: false', () => {
      const mediaLibraries = /** @type {any} */ ({
        lib1: { config: { multiple: false } },
        lib2: { config: { multiple: false } },
      });

      expect(hasMultipleInMediaLibraries(mediaLibraries)).toBe(false);
    });

    it('should return undefined when no library has explicit multiple setting', () => {
      const mediaLibraries = /** @type {any} */ ({
        lib1: { config: {} },
        lib2: { config: {} },
      });

      expect(hasMultipleInMediaLibraries(mediaLibraries)).toBeUndefined();
    });

    it('should return true when one library has multiple: true and others undefined', () => {
      const mediaLibraries = /** @type {any} */ ({
        lib1: { config: { multiple: true } },
        lib2: { config: {} },
      });

      expect(hasMultipleInMediaLibraries(mediaLibraries)).toBe(true);
    });

    it('should handle stock asset libraries without config property', () => {
      const mediaLibraries = /** @type {any} */ ({
        stock: {}, // Stock library without config
        default: { config: { multiple: true } },
      });

      expect(hasMultipleInMediaLibraries(mediaLibraries)).toBe(true);
    });
  });

  describe('hasMultipleInMediaLibrary', () => {
    it('should return undefined when mediaLibrary is undefined', () => {
      expect(hasMultipleInMediaLibrary(undefined)).toBeUndefined();
    });

    it('should return undefined when config is missing', () => {
      const mediaLibrary = /** @type {any} */ ({});

      expect(hasMultipleInMediaLibrary(mediaLibrary)).toBeUndefined();
    });

    it('should return true when multiple is true', () => {
      const mediaLibrary = /** @type {any} */ ({
        config: { multiple: true },
      });

      expect(hasMultipleInMediaLibrary(mediaLibrary)).toBe(true);
    });

    it('should return false when multiple is false', () => {
      const mediaLibrary = /** @type {any} */ ({
        config: { multiple: false },
      });

      expect(hasMultipleInMediaLibrary(mediaLibrary)).toBe(false);
    });

    it('should return undefined when multiple is not a boolean', () => {
      const mediaLibrary = /** @type {any} */ ({
        config: { multiple: 'yes' },
      });

      expect(hasMultipleInMediaLibrary(mediaLibrary)).toBeUndefined();
    });

    it('should return undefined when multiple is not set', () => {
      const mediaLibrary = /** @type {any} */ ({
        config: {},
      });

      expect(hasMultipleInMediaLibrary(mediaLibrary)).toBeUndefined();
    });
  });
});
