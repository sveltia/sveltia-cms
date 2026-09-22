import { describe, expect, test } from 'vitest';

import {
  getAcceptedImageFormatLabels,
  HEIC_IMAGE_TYPES,
  RASTER_IMAGE_CONVERSION_FORMATS,
  RASTER_IMAGE_EXTENSION_REGEX,
  RASTER_IMAGE_FORMATS,
  RASTER_IMAGE_TYPES,
  SUPPORTED_IMAGE_FORMATS,
  SUPPORTED_IMAGE_TYPES,
  SUPPORTED_IMAGE_TYPES_WITH_HEIC,
  VECTOR_IMAGE_EXTENSION_REGEX,
  VECTOR_IMAGE_FORMATS,
  VECTOR_IMAGE_TYPES,
} from '.';

describe('Image Constants', () => {
  test('RASTER_IMAGE_FORMATS should contain expected formats', () => {
    expect(RASTER_IMAGE_FORMATS).toEqual(['avif', 'gif', 'heic', 'jpeg', 'png', 'webp']);
  });

  test('RASTER_IMAGE_TYPES should contain the MIME types every browser displays', () => {
    // HEIC is excluded, as only Safari displays it
    expect(RASTER_IMAGE_TYPES).toEqual([
      'image/avif',
      'image/gif',
      'image/jpeg',
      'image/png',
      'image/webp',
    ]);
  });

  test('HEIC_IMAGE_TYPES should contain the HEIC MIME types', () => {
    expect(HEIC_IMAGE_TYPES).toEqual(['image/heic', 'image/heif']);
  });

  test('RASTER_IMAGE_EXTENSION_REGEX should match raster image extensions', () => {
    expect(RASTER_IMAGE_EXTENSION_REGEX.test('test.png')).toBe(true);
    expect(RASTER_IMAGE_EXTENSION_REGEX.test('test.jpg')).toBe(true);
    expect(RASTER_IMAGE_EXTENSION_REGEX.test('test.jpeg')).toBe(true);
    expect(RASTER_IMAGE_EXTENSION_REGEX.test('test.jpe')).toBe(true);
    expect(RASTER_IMAGE_EXTENSION_REGEX.test('test.jfif')).toBe(true);
    expect(RASTER_IMAGE_EXTENSION_REGEX.test('test.JFIF')).toBe(true);
    expect(RASTER_IMAGE_EXTENSION_REGEX.test('test.gif')).toBe(true);
    expect(RASTER_IMAGE_EXTENSION_REGEX.test('test.webp')).toBe(true);
    expect(RASTER_IMAGE_EXTENSION_REGEX.test('test.avif')).toBe(true);
    expect(RASTER_IMAGE_EXTENSION_REGEX.test('test.heic')).toBe(true);
    expect(RASTER_IMAGE_EXTENSION_REGEX.test('IMG_0001.HEIC')).toBe(true);
    expect(RASTER_IMAGE_EXTENSION_REGEX.test('test.heif')).toBe(true);
    expect(RASTER_IMAGE_EXTENSION_REGEX.test('test.svg')).toBe(false);
    expect(RASTER_IMAGE_EXTENSION_REGEX.test('test.txt')).toBe(false);
  });

  test('VECTOR_IMAGE_FORMATS should contain expected formats', () => {
    expect(VECTOR_IMAGE_FORMATS).toEqual(['svg']);
  });

  test('VECTOR_IMAGE_TYPES should contain expected MIME types', () => {
    expect(VECTOR_IMAGE_TYPES).toEqual(['image/svg+xml']);
  });

  test('VECTOR_IMAGE_EXTENSION_REGEX should match vector image extensions', () => {
    expect(VECTOR_IMAGE_EXTENSION_REGEX.test('test.svg')).toBe(true);
    expect(VECTOR_IMAGE_EXTENSION_REGEX.test('test.png')).toBe(false);
    expect(VECTOR_IMAGE_EXTENSION_REGEX.test('test.txt')).toBe(false);
  });

  test('SUPPORTED_IMAGE_FORMATS should include both raster and vector formats', () => {
    expect(SUPPORTED_IMAGE_FORMATS).toEqual(['avif', 'gif', 'heic', 'jpeg', 'png', 'webp', 'svg']);
  });

  test('SUPPORTED_IMAGE_TYPES should include both raster and vector MIME types', () => {
    expect(SUPPORTED_IMAGE_TYPES).toEqual([
      'image/avif',
      'image/gif',
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/svg+xml',
    ]);
  });

  test('SUPPORTED_IMAGE_TYPES_WITH_HEIC should add the HEIC MIME types', () => {
    expect(SUPPORTED_IMAGE_TYPES_WITH_HEIC).toEqual([
      ...SUPPORTED_IMAGE_TYPES,
      'image/heic',
      'image/heif',
    ]);
  });

  describe('getAcceptedImageFormatLabels', () => {
    test('should name the formats of the image type lists', () => {
      expect(getAcceptedImageFormatLabels(SUPPORTED_IMAGE_TYPES.join(','))).toEqual([
        'AVIF',
        'GIF',
        'JPEG',
        'PNG',
        'WebP',
        'SVG',
      ]);
      expect(getAcceptedImageFormatLabels(SUPPORTED_IMAGE_TYPES_WITH_HEIC.join(','))).toEqual([
        'AVIF',
        'GIF',
        'HEIC',
        'JPEG',
        'PNG',
        'WebP',
        'SVG',
      ]);
    });

    test('should return undefined for any other list', () => {
      expect(getAcceptedImageFormatLabels(undefined)).toBeUndefined();
      expect(getAcceptedImageFormatLabels('')).toBeUndefined();
      expect(getAcceptedImageFormatLabels('image/png,image/jpeg')).toBeUndefined();
      expect(getAcceptedImageFormatLabels('application/pdf')).toBeUndefined();
    });
  });

  test('RASTER_IMAGE_CONVERSION_FORMATS should contain expected conversion formats', () => {
    expect(RASTER_IMAGE_CONVERSION_FORMATS).toEqual(['webp']);
  });
});
