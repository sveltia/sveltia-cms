import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { extractExifData } from './exif';

// Mock ExifReader
vi.mock('exifreader', () => ({
  default: {
    load: vi.fn(),
  },
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
      exif: {
        DateTimeOriginal: { description: '2023:10:01 12:34:56' },
        DateTime: { description: '2023:10:01 12:34:57' },
      },
      gps: {
        Latitude: 37.7749,
        Longitude: -122.4194,
      },
    };

    const ExifReader = (await import('exifreader')).default;

    vi.mocked(ExifReader.load).mockResolvedValue(/** @type {any} */ (mockExifData));

    const { toFixed } = await import('$lib/services/utils/number');

    vi.mocked(toFixed).mockReturnValueOnce(37.7749).mockReturnValueOnce(-122.4194);

    const result = await extractExifData(mockAsset, 'image');

    expect(result).toEqual({
      createdDate: new Date('2023-10-01T12:34:56Z'),
      coordinates: {
        latitude: 37.7749,
        longitude: -122.4194,
      },
    });

    expect(toFixed).toHaveBeenCalledWith(37.7749, 7);
    expect(toFixed).toHaveBeenCalledWith(-122.4194, 7);
  });

  test('should prefer DateTimeOriginal over DateTime', async () => {
    const mockAsset = /** @type {any} */ ({
      file: new File([''], 'test.jpg', { type: 'image/jpeg' }),
    });

    const mockExifData = {
      exif: {
        DateTimeOriginal: { description: '2023:10:01 12:34:56' },
        DateTime: { description: '2023:10:01 12:34:57' },
      },
      gps: {},
    };

    const ExifReader = (await import('exifreader')).default;

    vi.mocked(ExifReader.load).mockResolvedValue(/** @type {any} */ (mockExifData));

    const result = await extractExifData(mockAsset, 'image');

    expect(result.createdDate).toEqual(new Date('2023-10-01T12:34:56Z'));
  });

  test('should use DateTime when DateTimeOriginal is not available', async () => {
    const mockAsset = /** @type {any} */ ({
      file: new File([''], 'test.jpg', { type: 'image/jpeg' }),
    });

    const mockExifData = {
      exif: {
        DateTime: { description: '2023:10:01 12:34:57' },
      },
      gps: {},
    };

    const ExifReader = (await import('exifreader')).default;

    vi.mocked(ExifReader.load).mockResolvedValue(/** @type {any} */ (mockExifData));

    const result = await extractExifData(mockAsset, 'image');

    expect(result.createdDate).toEqual(new Date('2023-10-01T12:34:57Z'));
  });

  test('should handle invalid date format', async () => {
    const mockAsset = /** @type {any} */ ({
      file: new File([''], 'test.jpg', { type: 'image/jpeg' }),
    });

    const mockExifData = {
      exif: {
        DateTime: { description: 'invalid-date-format' },
      },
      gps: {},
    };

    const ExifReader = (await import('exifreader')).default;

    vi.mocked(ExifReader.load).mockResolvedValue(/** @type {any} */ (mockExifData));

    const result = await extractExifData(mockAsset, 'image');

    expect(result.createdDate).toBeUndefined();
  });

  test('should handle invalid coordinates', async () => {
    const mockAsset = /** @type {any} */ ({
      file: new File([''], 'test.jpg', { type: 'image/jpeg' }),
    });

    const mockExifData = {
      exif: {},
      gps: {
        Latitude: Number.NaN,
        Longitude: Number.POSITIVE_INFINITY,
      },
    };

    const ExifReader = (await import('exifreader')).default;

    vi.mocked(ExifReader.load).mockResolvedValue(/** @type {any} */ (mockExifData));

    const result = await extractExifData(mockAsset, 'image');

    expect(result.coordinates).toBeUndefined();
  });

  test('should handle missing GPS data', async () => {
    const mockAsset = /** @type {any} */ ({
      file: new File([''], 'test.jpg', { type: 'image/jpeg' }),
    });

    const mockExifData = {
      exif: {},
      gps: {},
    };

    const ExifReader = (await import('exifreader')).default;

    vi.mocked(ExifReader.load).mockResolvedValue(/** @type {any} */ (mockExifData));

    const result = await extractExifData(mockAsset, 'image');

    expect(result.coordinates).toBeUndefined();
  });

  test('should handle ExifReader load failure', async () => {
    const mockAsset = /** @type {any} */ ({
      file: new File([''], 'test.jpg', { type: 'image/jpeg' }),
    });

    const ExifReader = (await import('exifreader')).default;

    vi.mocked(ExifReader.load).mockRejectedValue(new Error('Failed to load EXIF'));

    const result = await extractExifData(mockAsset, 'image');

    expect(result).toEqual({
      createdDate: undefined,
      coordinates: undefined,
    });
  });
});
