import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  canConvertHEIC,
  getAcceptedImageTypes,
  getDefaultMediaLibraryOptions,
  transformFile,
} from '.';

// Mock all dependencies
vi.mock('@sveltia/utils/object');
vi.mock('$lib/services/integrations/media-libraries', () => ({
  getMediaLibraryOptions: vi.fn(),
}));
vi.mock('$lib/services/utils/media/image', () => ({
  RASTER_IMAGE_CONVERSION_FORMATS: ['webp', 'jpeg', 'png'],
  RASTER_IMAGE_EXTENSION_REGEX: /\b(?:avif|gif|heic|heif|jfif|jpe?g|jpe|png|webp)$/i,
  RASTER_IMAGE_FORMATS: ['heic', 'jpeg', 'jpg', 'png', 'webp'],
  SUPPORTED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/svg+xml'],
  SUPPORTED_IMAGE_TYPES_WITH_HEIC: ['image/jpeg', 'image/png', 'image/svg+xml', 'image/heic'],
}));
vi.mock('$lib/services/utils/media/image/transform');

/**
 * Leading bytes of a HEIC file: an ISO BMFF `ftyp` box with the `heic` major brand.
 * @type {Uint8Array<ArrayBuffer>}
 */
const HEIC_HEADER = new Uint8Array([
  0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63, 0, 0, 0, 0, 0x6d, 0x69, 0x66, 0x31,
  0x68, 0x65, 0x69, 0x63,
]);

/**
 * Leading bytes of a JPEG file: the SOI marker and a JFIF segment.
 * @type {Uint8Array<ArrayBuffer>}
 */
const JPEG_HEADER = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00,
]);

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
        enabled: true,
        config: {
          max_file_size: Infinity,
          multiple: false,
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
        enabled: true,
        config: {
          max_file_size: 500000,
          multiple: false,
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
        enabled: true,
        config: {
          max_file_size: 300000,
          multiple: false,
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
        enabled: true,
        config: {
          max_file_size: Infinity,
          multiple: false,
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
        enabled: true,
        config: {
          max_file_size: 1024000,
          multiple: false,
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
        enabled: true,
        config: {
          max_file_size: Infinity,
          multiple: false,
          slugify_filename: false,
          transformations: undefined,
        },
      });
    });

    it('should return enabled: false when default library is explicitly disabled', async () => {
      const { getMediaLibraryOptions } = await import('$lib/services/integrations/media-libraries');
      const getMock = vi.mocked(getMediaLibraryOptions);

      getMock.mockReturnValue(/** @type {any} */ (false));

      const fieldConfig = /** @type {any} */ ({
        media_libraries: {
          default: false,
        },
      });

      const result = getDefaultMediaLibraryOptions({ fieldConfig });

      expect(result).toEqual({
        enabled: false,
        config: {
          max_file_size: Infinity,
          multiple: false,
          slugify_filename: false,
          transformations: undefined,
        },
      });
    });

    it('should return enabled: false when default library is explicitly disabled', async () => {
      const { getMediaLibraryOptions } = await import('$lib/services/integrations/media-libraries');
      const getMock = vi.mocked(getMediaLibraryOptions);

      getMock.mockReturnValue(/** @type {any} */ (false));

      const fieldConfig = /** @type {any} */ ({
        media_libraries: {
          default: false,
        },
      });

      const result = getDefaultMediaLibraryOptions({ fieldConfig });

      expect(result).toEqual({
        enabled: false,
        config: {
          max_file_size: Infinity,
          multiple: false,
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
        enabled: true,
        config: {
          max_file_size: Infinity,
          multiple: false,
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
        enabled: true,
        config: {
          max_file_size: Infinity,
          multiple: false,
          slugify_filename: false,
          transformations: undefined,
        },
      });
    });

    it('should handle multiple property when explicitly set to true', async () => {
      const { getMediaLibraryOptions } = await import('$lib/services/integrations/media-libraries');
      const getMock = vi.mocked(getMediaLibraryOptions);

      getMock.mockReturnValue({
        config: {
          multiple: true,
          max_file_size: 1000000,
        },
      });

      const fieldConfig = /** @type {any} */ ({
        media_libraries: {
          default: {
            config: {
              multiple: true,
              max_file_size: 1000000,
            },
          },
        },
      });

      const result = getDefaultMediaLibraryOptions({ fieldConfig });

      expect(result).toEqual({
        enabled: true,
        config: {
          max_file_size: 1000000,
          multiple: true,
          slugify_filename: false,
          transformations: undefined,
        },
      });
    });

    it('should handle multiple property when explicitly set to false', async () => {
      const { getMediaLibraryOptions } = await import('$lib/services/integrations/media-libraries');
      const getMock = vi.mocked(getMediaLibraryOptions);

      getMock.mockReturnValue({
        config: {
          multiple: false,
          slugify_filename: true,
        },
      });

      const fieldConfig = /** @type {any} */ ({
        media_libraries: {
          default: {
            config: {
              multiple: false,
              slugify_filename: true,
            },
          },
        },
      });

      const result = getDefaultMediaLibraryOptions({ fieldConfig });

      expect(result).toEqual({
        enabled: true,
        config: {
          max_file_size: Infinity,
          multiple: false,
          slugify_filename: true,
          transformations: undefined,
        },
      });
    });

    it('should default multiple to false when not boolean', async () => {
      const { getMediaLibraryOptions } = await import('$lib/services/integrations/media-libraries');
      const getMock = vi.mocked(getMediaLibraryOptions);

      getMock.mockReturnValue({
        config: {
          multiple: 'not-boolean',
        },
      });

      const fieldConfig = /** @type {any} */ ({
        media_libraries: {
          default: {
            config: {
              multiple: 'not-boolean',
            },
          },
        },
      });

      const result = getDefaultMediaLibraryOptions({ fieldConfig });

      expect(result).toEqual({
        enabled: true,
        config: {
          max_file_size: Infinity,
          multiple: false,
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

    describe('HEIC', () => {
      /** @type {Blob} */
      let webpBlob;

      beforeEach(async () => {
        const { transformImage } = await import('$lib/services/utils/media/image/transform');

        webpBlob = new Blob(['transformed'], { type: 'image/webp' });
        vi.mocked(transformImage).mockResolvedValue(webpBlob);
      });

      it('should not convert a HEIC image unless configured', async () => {
        const { transformImage } = await import('$lib/services/utils/media/image/transform');
        const file = new File([HEIC_HEADER], 'IMG_0001.HEIC', { type: 'image/heic' });

        await expect(transformFile(file, {})).resolves.toBe(file);
        await expect(transformFile(file, { jpeg: {}, png: {} })).resolves.toBe(file);
        expect(vi.mocked(transformImage)).not.toHaveBeenCalled();
      });

      it('should convert a HEIC image to WebP by default', async () => {
        const { transformImage } = await import('$lib/services/utils/media/image/transform');
        const file = new File([HEIC_HEADER], 'IMG_0001.HEIC', { type: 'image/heic' });
        const result = await transformFile(file, { heic: {} });

        expect(vi.mocked(transformImage)).toHaveBeenCalledWith(file, {
          format: 'webp',
          quality: 85,
          width: undefined,
          height: undefined,
        });
        expect(result.name).toBe('IMG_0001.webp');
        expect(result.type).toBe('image/webp');
      });

      it('should convert a HEIC image with a `.jpg` extension, detected by its content', async () => {
        const { transformImage } = await import('$lib/services/utils/media/image/transform');
        // A photo that was renamed rather than converted declares `image/jpeg`
        const file = new File([HEIC_HEADER], 'IMG_0001.jpg', { type: 'image/jpeg' });
        const transformations = /** @type {any} */ ({ jpeg: { quality: 50 }, heic: {} });
        const result = await transformFile(file, transformations);

        // The `jpeg` transformation doesn’t apply, as the image isn’t a JPEG
        expect(vi.mocked(transformImage)).toHaveBeenCalledWith(file, {
          format: 'webp',
          quality: 85,
          width: undefined,
          height: undefined,
        });
        expect(result.name).toBe('IMG_0001.webp');
      });

      it.each([
        ['image/heif', 'IMG_0001.heif'],
        ['', 'IMG_0001.heic'],
        ['application/octet-stream', 'IMG_0001.heic'],
      ])('should detect a HEIC image declared as “%s”', async (type, name) => {
        const { transformImage } = await import('$lib/services/utils/media/image/transform');
        // The type isn’t set on every platform
        const file = new File([HEIC_HEADER], name, { type });
        const result = await transformFile(file, { raster_image: {} });

        expect(vi.mocked(transformImage)).toHaveBeenCalledOnce();
        expect(result.name).toBe('IMG_0001.webp');
      });

      it('should apply the `heic` transformation over `raster_image`', async () => {
        const { transformImage } = await import('$lib/services/utils/media/image/transform');
        const file = new File([HEIC_HEADER], 'IMG_0001.heic', { type: 'image/heic' });

        const transformations = /** @type {any} */ ({
          raster_image: { quality: 60 },
          heic: { quality: 70, width: 2000 },
        });

        await transformFile(file, transformations);

        expect(vi.mocked(transformImage)).toHaveBeenCalledWith(file, {
          format: 'webp',
          quality: 70,
          width: 2000,
          height: undefined,
        });
      });

      it('should apply the `raster_image` transformation to a HEIC image', async () => {
        const { transformImage } = await import('$lib/services/utils/media/image/transform');
        const file = new File([HEIC_HEADER], 'IMG_0001.heic', { type: 'image/heic' });
        const transformations = /** @type {any} */ ({ raster_image: { quality: 60 } });

        await transformFile(file, transformations);

        expect(vi.mocked(transformImage)).toHaveBeenCalledWith(file, {
          format: 'webp',
          quality: 60,
          width: undefined,
          height: undefined,
        });
      });

      it('should throw when a HEIC image can’t be decoded', async () => {
        const { transformImage } = await import('$lib/services/utils/media/image/transform');

        vi.mocked(transformImage).mockRejectedValue(new Error('Decoding error'));

        const file = new File([HEIC_HEADER], 'IMG_0001.heic', { type: 'image/heic' });

        // Rather than uploading the file as is, which nothing could display
        await expect(transformFile(file, { heic: {} })).rejects.toThrow(
          'Failed to decode HEIC image',
        );
      });

      it('should not treat a JPEG image with a `.heic` extension as HEIC', async () => {
        const { transformImage } = await import('$lib/services/utils/media/image/transform');
        const file = new File([JPEG_HEADER], 'IMG_0001.heic', { type: 'image/heic' });

        // No transformation for JPEG or HEIC, so nothing happens
        await expect(transformFile(file, { png: {} })).resolves.toBe(file);
        expect(vi.mocked(transformImage)).not.toHaveBeenCalled();

        // The `jpeg` transformation applies, with the `heic` one for the declared format as a
        // fallback; either way the browser decodes it, and a decoding failure isn’t fatal
        await Promise.all(
          [{ jpeg: { quality: 50 } }, { heic: { quality: 50 } }].map(async (transformations) => {
            const result = await transformFile(file, transformations);

            expect(result.name).toBe('IMG_0001.webp');
          }),
        );
        expect(vi.mocked(transformImage)).toHaveBeenCalledTimes(2);
        expect(vi.mocked(transformImage)).toHaveBeenLastCalledWith(file, {
          format: 'webp',
          quality: 50,
          width: undefined,
          height: undefined,
        });

        vi.mocked(transformImage).mockRejectedValue(new Error('Corrupt'));
        await expect(transformFile(file, { heic: {} })).resolves.toBe(file);
      });

      it('should fall back to the transformation for the declared format', async () => {
        const { transformImage } = await import('$lib/services/utils/media/image/transform');
        // A JPEG image saved with a `.png` extension, on a site with `png` options only
        const file = new File([JPEG_HEADER], 'shot.png', { type: 'image/png' });
        const result = await transformFile(file, { png: { quality: 60 } });

        expect(vi.mocked(transformImage)).toHaveBeenCalledWith(file, {
          format: 'webp',
          quality: 60,
          width: undefined,
          height: undefined,
        });
        expect(result.name).toBe('shot.webp');

        // The transformation for the actual format wins
        vi.mocked(transformImage).mockClear();
        await transformFile(file, { png: { quality: 60 }, jpeg: { quality: 70 } });
        expect(vi.mocked(transformImage)).toHaveBeenCalledWith(
          file,
          expect.objectContaining({ quality: 70 }),
        );
      });

      it('should not sniff a file that is neither an image nor named like one', async () => {
        const file = new File([HEIC_HEADER], 'photo.bin', { type: '' });
        const transformations = /** @type {any} */ ({ raster_image: {} });

        await expect(transformFile(file, transformations)).resolves.toBe(file);
      });
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

    it('should return original file when the image cannot be decoded', async () => {
      const { transformImage } = await import('$lib/services/utils/media/image/transform');

      // A truncated JPEG image can’t be decoded, so the transformation fails
      vi.mocked(transformImage).mockRejectedValue(new Error('Failed to decode image'));

      const transformations = /** @type {any} */ ({ jpeg: { format: 'webp' } });
      const result = await transformFile(jpegFile, transformations);

      // The upload proceeds with the original file rather than hanging or failing
      expect(result).toBe(jpegFile);
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

    it('should use default values for omitted transformation options', async () => {
      const { transformImage } = await import('$lib/services/utils/media/image/transform');
      const mockBlob = new Blob(['transformed'], { type: 'image/webp' });

      vi.mocked(transformImage).mockResolvedValue(mockBlob);

      // The options are validated by the config parser, so only the documented defaults are
      // applied here
      const transformations = /** @type {any} */ ({ jpeg: {} });
      const result = await transformFile(jpegFile, transformations);

      expect(vi.mocked(transformImage)).toHaveBeenCalledWith(jpegFile, {
        format: 'webp',
        quality: 85,
        width: undefined,
        height: undefined,
      });

      expect(result.name).toBe('image.webp');
    });

    it('should name the file after the format actually produced', async () => {
      const { transformImage } = await import('$lib/services/utils/media/image/transform');
      // Safari without native WebP encoding and the fallback encoder exports PNG
      const mockBlob = new Blob(['transformed'], { type: 'image/png' });

      vi.mocked(transformImage).mockResolvedValue(mockBlob);

      const transformations = /** @type {any} */ ({
        jpeg: { format: 'webp' },
      });

      const result = await transformFile(jpegFile, transformations);

      // Rather than PNG bytes under a `.jpg` name
      expect(result.name).toBe('image.png');
      expect(result.type).toBe('image/png');

      const heicFile = new File([HEIC_HEADER], 'IMG_0001.heic', { type: 'image/heic' });

      await expect(transformFile(heicFile, { heic: {} })).resolves.toMatchObject({
        name: 'IMG_0001.png',
        type: 'image/png',
      });
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

      expect(result.name).toBe('image.webp'); // extension appended with a dot
    });

    it('should replace a JPEG alias extension when converting to WebP', async () => {
      const { transformImage } = await import('$lib/services/utils/media/image/transform');
      const mockBlob = new Blob(['transformed'], { type: 'image/webp' });
      const transformations = /** @type {any} */ ({ raster_image: { format: 'webp' } });

      vi.mocked(transformImage).mockResolvedValue(mockBlob);

      // Chrome on Windows often saves JPEG files with the `.jfif` extension
      const jfifFile = new File(['content'], 'photo.jfif', { type: 'image/jpeg' });

      expect((await transformFile(jfifFile, transformations)).name).toBe('photo.webp');

      const jpeFile = new File(['content'], 'photo.JPE', { type: 'image/jpeg' });

      expect((await transformFile(jpeFile, transformations)).name).toBe('photo.webp');
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

    it('should not transform non-raster image formats even with format-specific transformation', async () => {
      const { transformImage } = await import('$lib/services/utils/media/image/transform');

      const transformations = /** @type {any} */ ({
        tiff: { format: 'webp' },
      });

      // Format-specific key matching a non-raster format should also be ignored
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

  describe('getAcceptedImageTypes', () => {
    it('should add the HEIC types only if HEIC images are converted', () => {
      expect(getAcceptedImageTypes(undefined)).toEqual([
        'image/jpeg',
        'image/png',
        'image/svg+xml',
      ]);
      expect(getAcceptedImageTypes({ jpeg: {} })).toEqual([
        'image/jpeg',
        'image/png',
        'image/svg+xml',
      ]);
      expect(getAcceptedImageTypes({ raster_image: {} })).toEqual([
        'image/jpeg',
        'image/png',
        'image/svg+xml',
        'image/heic',
      ]);
      expect(getAcceptedImageTypes({ heic: {} })).toContain('image/heic');
    });
  });

  describe('canConvertHEIC', () => {
    it('should be true with a HEIC or generic raster image transformation', () => {
      expect(canConvertHEIC({ heic: {} })).toBe(true);
      expect(canConvertHEIC({ raster_image: { format: 'webp' } })).toBe(true);
      expect(canConvertHEIC({ raster_image: {}, jpeg: {} })).toBe(true);
    });

    it('should be false otherwise', () => {
      expect(canConvertHEIC(undefined)).toBe(false);
      expect(canConvertHEIC({})).toBe(false);
      expect(canConvertHEIC({ jpeg: {}, png: {}, svg: { optimize: true } })).toBe(false);
    });
  });
});
