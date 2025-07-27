import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getDefaultMediaLibraryOptions, transformFile } from './index';

// Mock all dependencies
vi.mock('@sveltia/utils/object');
vi.mock('$lib/services/integrations/media-libraries', () => ({
  getMediaLibraryOptions: vi.fn(),
}));
vi.mock('$lib/services/utils/media/image', () => ({
  RASTER_IMAGE_CONVERSION_FORMATS: ['webp', 'jpeg', 'png'],
  RASTER_IMAGE_EXTENSION_REGEX: /\b(?:avif|gif|jpe?g|png|webp)$/i,
  RASTER_IMAGE_FORMATS: ['jpeg', 'jpg', 'png', 'webp'],
}));
vi.mock('$lib/services/utils/media/image/transform');

describe('integrations/media-libraries/default', () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup isObject mock
    const { isObject } = await import('@sveltia/utils/object');

    vi.mocked(isObject).mockImplementation(
      (value) => value !== null && typeof value === 'object' && !Array.isArray(value),
    );
  });

  describe('getDefaultMediaLibraryOptions', () => {
    it('should return default options when no field config is provided', async () => {
      const { getMediaLibraryOptions } = await import('$lib/services/integrations/media-libraries');
      const getMock = vi.mocked(getMediaLibraryOptions);

      getMock.mockReturnValue({});

      const result = getDefaultMediaLibraryOptions();

      expect(result).toEqual({
        config: {
          max_file_size: Infinity,
          slugify_filename: false,
          transformations: undefined,
        },
      });
    });

    it('should return field-level media library options', async () => {
      const { getMediaLibraryOptions } = await import('$lib/services/integrations/media-libraries');
      const getMock = vi.mocked(getMediaLibraryOptions);

      getMock.mockReturnValue({
        config: {
          max_file_size: 500000,
          slugify_filename: true,
          transformations: {
            jpeg: { format: 'webp' },
          },
        },
      });

      const fieldConfig = /** @type {any} */ ({
        media_libraries: {
          default: {
            config: {
              max_file_size: 500000,
              slugify_filename: true,
              transformations: {
                jpeg: { format: 'webp' },
              },
            },
          },
        },
      });

      const result = getDefaultMediaLibraryOptions({ fieldConfig });

      expect(result).toEqual({
        config: {
          max_file_size: 500000,
          slugify_filename: true,
          transformations: {
            jpeg: { format: 'webp' },
          },
        },
      });
    });

    it('should return legacy field-level media library options', async () => {
      const { getMediaLibraryOptions } = await import('$lib/services/integrations/media-libraries');
      const getMock = vi.mocked(getMediaLibraryOptions);

      getMock.mockReturnValue({
        name: 'default',
        config: {
          max_file_size: 300000,
          slugify_filename: false,
        },
      });

      const fieldConfig = /** @type {any} */ ({
        media_library: {
          name: 'default',
          config: {
            max_file_size: 300000,
            slugify_filename: false,
          },
        },
      });

      const result = getDefaultMediaLibraryOptions({ fieldConfig });

      expect(result).toEqual({
        config: {
          max_file_size: 300000,
          slugify_filename: false,
          transformations: undefined,
        },
      });
    });

    it('should fallback to site-level media libraries config', async () => {
      const { getMediaLibraryOptions } = await import('$lib/services/integrations/media-libraries');
      const getMock = vi.mocked(getMediaLibraryOptions);

      getMock.mockReturnValue({});

      const result = getDefaultMediaLibraryOptions();

      expect(result).toEqual({
        config: {
          max_file_size: Infinity,
          slugify_filename: false,
          transformations: undefined,
        },
      });
    });

    it('should fallback to legacy site-level media library config', async () => {
      const { getMediaLibraryOptions } = await import('$lib/services/integrations/media-libraries');
      const getMock = vi.mocked(getMediaLibraryOptions);

      getMock.mockReturnValue({
        name: 'default',
        config: {
          max_file_size: 1024000,
          slugify_filename: true,
          transformations: {
            jpeg: { format: 'webp', quality: 80 },
          },
        },
      });

      const result = getDefaultMediaLibraryOptions();

      expect(result).toEqual({
        config: {
          max_file_size: 1024000,
          slugify_filename: true,
          transformations: {
            jpeg: { format: 'webp', quality: 80 },
          },
        },
      });
    });

    it('should handle boolean media library options', async () => {
      const { getMediaLibraryOptions } = await import('$lib/services/integrations/media-libraries');
      const getMock = vi.mocked(getMediaLibraryOptions);

      getMock.mockReturnValue(/** @type {any} */ (true));

      const fieldConfig = /** @type {any} */ ({
        media_libraries: {
          default: true,
        },
      });

      const result = getDefaultMediaLibraryOptions({ fieldConfig });

      expect(result).toEqual({
        config: {
          max_file_size: Infinity,
          slugify_filename: false,
          transformations: undefined,
        },
      });
    });

    it('should handle invalid max_file_size values', async () => {
      const { getMediaLibraryOptions } = await import('$lib/services/integrations/media-libraries');
      const getMock = vi.mocked(getMediaLibraryOptions);

      getMock.mockReturnValue({
        config: {
          max_file_size: 'invalid',
          slugify_filename: 'not-boolean',
        },
      });

      const fieldConfig = /** @type {any} */ ({
        media_libraries: {
          default: {
            config: {
              max_file_size: 'invalid',
              slugify_filename: 'not-boolean',
            },
          },
        },
      });

      const result = getDefaultMediaLibraryOptions({ fieldConfig });

      expect(result).toEqual({
        config: {
          max_file_size: Infinity,
          slugify_filename: false,
          transformations: undefined,
        },
      });
    });

    it('should handle transformations that are not objects', async () => {
      const { getMediaLibraryOptions } = await import('$lib/services/integrations/media-libraries');
      const getMock = vi.mocked(getMediaLibraryOptions);

      getMock.mockReturnValue({
        config: {
          transformations: 'not-an-object',
        },
      });

      const { isObject } = await import('@sveltia/utils/object');

      vi.mocked(isObject).mockReturnValue(false);

      const fieldConfig = /** @type {any} */ ({
        media_libraries: {
          default: {
            config: {
              transformations: 'not-an-object',
            },
          },
        },
      });

      const result = getDefaultMediaLibraryOptions({ fieldConfig });

      expect(result).toEqual({
        config: {
          max_file_size: Infinity,
          slugify_filename: false,
          transformations: undefined,
        },
      });
    });
  });

  describe('transformFile', () => {
    /** @type {File} */
    let jpegFile;
    /** @type {File} */
    let svgFile;
    /** @type {File} */
    let textFile;

    beforeEach(() => {
      jpegFile = new File(['jpeg content'], 'image.jpg', { type: 'image/jpeg' });
      svgFile = new File(['<svg></svg>'], 'image.svg', { type: 'image/svg+xml' });
      textFile = new File(['text content'], 'document.txt', { type: 'text/plain' });
    });

    it('should return original file when no transformations apply', async () => {
      const transformations = /** @type {any} */ ({});
      const result = await transformFile(jpegFile, transformations);

      expect(result).toBe(jpegFile);
    });

    it('should transform raster image with specific format transformation', async () => {
      const { transformImage } = await import('$lib/services/utils/media/image/transform');
      const mockBlob = new Blob(['transformed'], { type: 'image/webp' });

      vi.mocked(transformImage).mockResolvedValue(mockBlob);

      const transformations = /** @type {any} */ ({
        jpeg: {
          format: 'webp',
          quality: 85,
          width: 800,
          height: 600,
        },
      });

      const result = await transformFile(jpegFile, transformations);

      expect(vi.mocked(transformImage)).toHaveBeenCalledWith(jpegFile, {
        format: 'webp',
        quality: 85,
        width: 800,
        height: 600,
      });

      expect(result).toBeInstanceOf(File);
      expect(result.name).toBe('image.webp'); // jpg is replaced with webp
      expect(result.type).toBe('image/webp');
    });

    it('should transform raster image with generic raster_image transformation', async () => {
      const { transformImage } = await import('$lib/services/utils/media/image/transform');
      const mockBlob = new Blob(['transformed'], { type: 'image/webp' });

      vi.mocked(transformImage).mockResolvedValue(mockBlob);

      const transformations = /** @type {any} */ ({
        raster_image: {
          format: 'webp',
          quality: 80,
        },
      });

      const result = await transformFile(jpegFile, transformations);

      expect(vi.mocked(transformImage)).toHaveBeenCalledWith(jpegFile, {
        format: 'webp',
        quality: 80,
        width: undefined,
        height: undefined,
      });

      expect(result).toBeInstanceOf(File);
      expect(result.name).toBe('image.webp');
    });

    it('should use default values for invalid transformation options', async () => {
      const { transformImage } = await import('$lib/services/utils/media/image/transform');
      const mockBlob = new Blob(['transformed'], { type: 'image/webp' });

      vi.mocked(transformImage).mockResolvedValue(mockBlob);

      const transformations = /** @type {any} */ ({
        jpeg: {
          format: 'invalid-format',
          quality: 'not-a-number',
          width: 'invalid',
          height: -1,
        },
      });

      const result = await transformFile(jpegFile, transformations);

      expect(vi.mocked(transformImage)).toHaveBeenCalledWith(jpegFile, {
        format: 'webp', // fallback to default
        quality: 85, // fallback to default
        width: undefined, // invalid values become undefined
        height: -1, // negative numbers are valid integers
      });

      expect(result.name).toBe('image.webp');
    });

    it('should keep original filename when transformation fails', async () => {
      const { transformImage } = await import('$lib/services/utils/media/image/transform');
      const mockBlob = new Blob(['transformed'], { type: 'application/octet-stream' });

      vi.mocked(transformImage).mockResolvedValue(mockBlob);

      const transformations = /** @type {any} */ ({
        jpeg: { format: 'webp' },
      });

      const result = await transformFile(jpegFile, transformations);

      expect(result.name).toBe('image.jpg'); // original name kept
      expect(result.type).toBe('application/octet-stream');
    });

    it('should add extension when file has no extension for raster image', async () => {
      const { transformImage } = await import('$lib/services/utils/media/image/transform');
      const mockBlob = new Blob(['transformed'], { type: 'image/webp' });
      const noExtFile = new File(['content'], 'image', { type: 'image/jpeg' });

      vi.mocked(transformImage).mockResolvedValue(mockBlob);

      const transformations = /** @type {any} */ ({
        jpeg: { format: 'webp' },
      });

      const result = await transformFile(noExtFile, transformations);

      expect(result.name).toBe('imagewebp'); // extension concatenated
    });

    it('should optimize SVG when svg.optimize is true', async () => {
      const { optimizeSVG } = await import('$lib/services/utils/media/image/transform');
      const optimizedBlob = new Blob(['<svg optimized></svg>'], { type: 'image/svg+xml' });

      vi.mocked(optimizeSVG).mockResolvedValue(optimizedBlob);

      const transformations = /** @type {any} */ ({
        svg: { optimize: true },
      });

      const result = await transformFile(svgFile, transformations);

      expect(vi.mocked(optimizeSVG)).toHaveBeenCalledWith(svgFile);
      expect(result).toBeInstanceOf(File);
      expect(result.name).toBe('image.svg');
      expect(result.type).toBe('image/svg+xml');
    });

    it('should not optimize SVG when svg.optimize is false', async () => {
      const { optimizeSVG } = await import('$lib/services/utils/media/image/transform');

      const transformations = /** @type {any} */ ({
        svg: { optimize: false },
      });

      const result = await transformFile(svgFile, transformations);

      expect(vi.mocked(optimizeSVG)).not.toHaveBeenCalled();
      expect(result).toBe(svgFile);
    });

    it('should return original file for non-image files', async () => {
      const transformations = /** @type {any} */ ({
        jpeg: { format: 'webp' },
        svg: { optimize: true },
      });

      const result = await transformFile(textFile, transformations);

      expect(result).toBe(textFile);
    });

    it('should not transform non-raster image formats', async () => {
      const { transformImage } = await import('$lib/services/utils/media/image/transform');

      const transformations = /** @type {any} */ ({
        raster_image: { format: 'webp' },
      });

      // Test with a format not in RASTER_IMAGE_FORMATS
      const tiffFile = new File(['content'], 'image.tiff', { type: 'image/tiff' });
      const result = await transformFile(tiffFile, transformations);

      expect(vi.mocked(transformImage)).not.toHaveBeenCalled();
      expect(result).toBe(tiffFile);
    });

    it('should handle valid integer quality and dimensions', async () => {
      const { transformImage } = await import('$lib/services/utils/media/image/transform');
      const mockBlob = new Blob(['transformed'], { type: 'image/webp' });

      vi.mocked(transformImage).mockResolvedValue(mockBlob);

      const transformations = /** @type {any} */ ({
        jpeg: {
          quality: 90,
          width: 1920,
          height: 1080,
        },
      });

      await transformFile(jpegFile, transformations);

      expect(vi.mocked(transformImage)).toHaveBeenCalledWith(jpegFile, {
        format: 'webp',
        quality: 90,
        width: 1920,
        height: 1080,
      });
    });
  });
});
