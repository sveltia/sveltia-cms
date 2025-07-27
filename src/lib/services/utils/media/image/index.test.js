import { describe, expect, test } from 'vitest';

import {
  RASTER_IMAGE_CONVERSION_FORMATS,
  RASTER_IMAGE_EXTENSION_REGEX,
  RASTER_IMAGE_FORMATS,
  RASTER_IMAGE_TYPES,
  SUPPORTED_IMAGE_FORMATS,
  SUPPORTED_IMAGE_TYPES,
  VECTOR_IMAGE_EXTENSION_REGEX,
  VECTOR_IMAGE_FORMATS,
  VECTOR_IMAGE_TYPES,
} from './index.js';

describe('Image Constants', () => {
  test('RASTER_IMAGE_FORMATS should contain expected formats', () => {
    expect(RASTER_IMAGE_FORMATS).toEqual(['avif', 'gif', 'jpeg', 'png', 'webp']);
  });

  test('RASTER_IMAGE_TYPES should contain expected MIME types', () => {
    expect(RASTER_IMAGE_TYPES).toEqual([
      'image/avif',
      'image/gif',
      'image/jpeg',
      'image/png',
      'image/webp',
    ]);
  });

  test('RASTER_IMAGE_EXTENSION_REGEX should match raster image extensions', () => {
    expect(RASTER_IMAGE_EXTENSION_REGEX.test('test.png')).toBe(true);
    expect(RASTER_IMAGE_EXTENSION_REGEX.test('test.jpg')).toBe(true);
    expect(RASTER_IMAGE_EXTENSION_REGEX.test('test.jpeg')).toBe(true);
    expect(RASTER_IMAGE_EXTENSION_REGEX.test('test.gif')).toBe(true);
    expect(RASTER_IMAGE_EXTENSION_REGEX.test('test.webp')).toBe(true);
    expect(RASTER_IMAGE_EXTENSION_REGEX.test('test.avif')).toBe(true);
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
    expect(SUPPORTED_IMAGE_FORMATS).toEqual(['avif', 'gif', 'jpeg', 'png', 'webp', 'svg']);
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

  test('RASTER_IMAGE_CONVERSION_FORMATS should contain expected conversion formats', () => {
    expect(RASTER_IMAGE_CONVERSION_FORMATS).toEqual(['webp']);
  });
});
