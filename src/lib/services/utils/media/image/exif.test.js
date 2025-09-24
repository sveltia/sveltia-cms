import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { extractExifData } from './exif';

// Mock exifr
vi.mock('exifr', () => ({
  parse: vi.fn(),
}));

// Mock loadModule
vi.mock('$lib/services/app/dependencies', () => ({
  loadModule: vi.fn(),
}));

// Mock toFixed utility
vi.mock('$lib/services/utils/number', () => ({
  toFixed: vi.fn((num, decimals) => parseFloat(num.toFixed(decimals))),
}));

describe('extractExifData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should return undefined for non-image assets', async () => {
    const mockAsset = /** @type {any} */ ({
      file: new File([''], 'test.mp4', { type: 'video/mp4' }),
    });

    const result = await extractExifData(mockAsset, 'video');

    expect(result).toEqual({
      createdDate: undefined,
      coordinates: undefined,
    });
  });

  test('should return undefined when asset has no file', async () => {
    const mockAsset = /** @type {any} */ ({
      file: null,
    });

    const result = await extractExifData(mockAsset, 'image');

    expect(result).toEqual({
      createdDate: undefined,
      coordinates: undefined,
    });
  });

  test('should extract date and coordinates from EXIF data', async () => {
    const mockAsset = /** @type {any} */ ({
      file: new File([''], 'test.jpg', { type: 'image/jpeg' }),
    });

    const mockExifData = {
      DateTimeOriginal: new Date('2023-10-01T12:34:56Z'),
      CreateDate: new Date('2023-10-01T12:34:57Z'),
      latitude: 37.7749,
      longitude: -122.4194,
    };

    const mockParse = vi.fn().mockResolvedValue(mockExifData);
    const { loadModule } = await import('$lib/services/app/dependencies');

    vi.mocked(loadModule).mockResolvedValue({ parse: mockParse });

    const { toFixed } = await import('$lib/services/utils/number');

    vi.mocked(toFixed).mockReturnValueOnce(37.7749).mockReturnValueOnce(-122.4194);

    const result = await extractExifData(mockAsset, 'image');

    expect(result).toEqual({
      createdDate: new Date('2023-10-01T12:34:57Z'), // CreateDate takes priority
      coordinates: {
        latitude: 37.7749,
        longitude: -122.4194,
      },
    });

    expect(toFixed).toHaveBeenCalledWith(37.7749, 7);
    expect(toFixed).toHaveBeenCalledWith(-122.4194, 7);
    expect(loadModule).toHaveBeenCalledWith('exifr', 'dist/lite.esm.mjs');
  });

  test('should prefer CreateDate over DateTimeOriginal', async () => {
    const mockAsset = /** @type {any} */ ({
      file: new File([''], 'test.jpg', { type: 'image/jpeg' }),
    });

    const mockExifData = {
      DateTimeOriginal: new Date('2023-10-01T12:34:56Z'),
      CreateDate: new Date('2023-10-01T12:34:57Z'),
    };

    const mockParse = vi.fn().mockResolvedValue(mockExifData);
    const { loadModule } = await import('$lib/services/app/dependencies');

    vi.mocked(loadModule).mockResolvedValue({ parse: mockParse });

    const result = await extractExifData(mockAsset, 'image');

    expect(result.createdDate).toEqual(new Date('2023-10-01T12:34:57Z'));
  });

  test('should use DateTimeOriginal when CreateDate is not available', async () => {
    const mockAsset = /** @type {any} */ ({
      file: new File([''], 'test.jpg', { type: 'image/jpeg' }),
    });

    const mockExifData = {
      DateTimeOriginal: new Date('2023-10-01T12:34:56Z'),
    };

    const mockParse = vi.fn().mockResolvedValue(mockExifData);
    const { loadModule } = await import('$lib/services/app/dependencies');

    vi.mocked(loadModule).mockResolvedValue({ parse: mockParse });

    const result = await extractExifData(mockAsset, 'image');

    expect(result.createdDate).toEqual(new Date('2023-10-01T12:34:56Z'));
  });

  test('should handle invalid date format', async () => {
    const mockAsset = /** @type {any} */ ({
      file: new File([''], 'test.jpg', { type: 'image/jpeg' }),
    });

    const mockExifData = {
      CreateDate: 'invalid-date-format', // Non-Date object
    };

    const mockParse = vi.fn().mockResolvedValue(mockExifData);
    const { loadModule } = await import('$lib/services/app/dependencies');

    vi.mocked(loadModule).mockResolvedValue({ parse: mockParse });

    const result = await extractExifData(mockAsset, 'image');

    expect(result.createdDate).toBeUndefined();
  });

  test('should handle invalid coordinates', async () => {
    const mockAsset = /** @type {any} */ ({
      file: new File([''], 'test.jpg', { type: 'image/jpeg' }),
    });

    const mockExifData = {
      latitude: Number.NaN,
      longitude: Number.POSITIVE_INFINITY,
    };

    const mockParse = vi.fn().mockResolvedValue(mockExifData);
    const { loadModule } = await import('$lib/services/app/dependencies');

    vi.mocked(loadModule).mockResolvedValue({ parse: mockParse });

    const result = await extractExifData(mockAsset, 'image');

    expect(result.coordinates).toBeUndefined();
  });

  test('should handle missing GPS data', async () => {
    const mockAsset = /** @type {any} */ ({
      file: new File([''], 'test.jpg', { type: 'image/jpeg' }),
    });

    const mockExifData = {
      // No latitude/longitude properties
    };

    const mockParse = vi.fn().mockResolvedValue(mockExifData);
    const { loadModule } = await import('$lib/services/app/dependencies');

    vi.mocked(loadModule).mockResolvedValue({ parse: mockParse });

    const result = await extractExifData(mockAsset, 'image');

    expect(result.coordinates).toBeUndefined();
  });

  test('should handle exifr parse failure', async () => {
    const mockAsset = /** @type {any} */ ({
      file: new File([''], 'test.jpg', { type: 'image/jpeg' }),
    });

    const mockParse = vi.fn().mockRejectedValue(new Error('Failed to parse EXIF'));
    const { loadModule } = await import('$lib/services/app/dependencies');

    vi.mocked(loadModule).mockResolvedValue({ parse: mockParse });

    const result = await extractExifData(mockAsset, 'image');

    expect(result).toEqual({
      createdDate: undefined,
      coordinates: undefined,
    });
  });
});
