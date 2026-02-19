import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { getMediaMetadata } from './index';

// Mock the extractExifData function
vi.mock('$lib/services/utils/media/image/exif', () => ({
  extractExifData: vi.fn(),
}));

/**
 * Mock Image class factory.
 * @param {number} width Image width.
 * @param {number} height Image height.
 * @returns {object} Mock image instance.
 */
function createMockImage(width = 800, height = 600) {
  return {
    naturalWidth: width,
    naturalHeight: height,
    src: '',
    addEventListener: vi.fn(
      (/** @type {string} */ event, /** @type {(ev: any) => void} */ callback) => {
        if (event === 'load') {
          // Simulate image load
          setTimeout(callback, 0);
        }
      },
    ),
  };
}

describe('getMediaMetadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should get metadata for image', async () => {
    const mockAsset = /** @type {any} */ ({
      file: new File([''], 'test.jpg', { type: 'image/jpeg' }),
      name: 'test.jpg',
      path: '/test.jpg',
      sha: 'abc123',
      size: 1000,
      collectionName: 'test',
      folder: '/',
      kind: 'image',
    });

    const mockSrc = 'data:image/jpeg;base64,test';

    const mockExifData = {
      createdDate: new Date('2023-01-01'),
      coordinates: { latitude: 37.7749, longitude: -122.4194 },
    };

    // Mock extractExifData
    const { extractExifData } = await import('$lib/services/utils/media/image/exif');

    vi.mocked(extractExifData).mockResolvedValue(mockExifData);

    // Mock global Image with proper constructor
    /** @type {any} */
    class MockImage {
      /**
       * Creates a mock image instance.
       */
      constructor() {
        Object.assign(this, createMockImage());
      }
    }

    // @ts-ignore - MockImage doesn't fully implement HTMLImageElement interface
    global.Image = MockImage;

    const result = await getMediaMetadata(mockAsset, mockSrc, 'image');

    expect(result).toEqual({
      dimensions: { width: 800, height: 600 },
      duration: undefined,
      createdDate: mockExifData.createdDate,
      coordinates: mockExifData.coordinates,
    });

    expect(extractExifData).toHaveBeenCalledWith(mockAsset, 'image');
  });

  test('should get metadata for video', async () => {
    const mockAsset = /** @type {any} */ ({
      file: new File([''], 'test.mp4', { type: 'video/mp4' }),
      name: 'test.mp4',
      path: '/test.mp4',
      sha: 'abc123',
      size: 2000,
      collectionName: 'test',
      folder: '/',
      kind: 'video',
    });

    const mockSrc = 'data:video/mp4;base64,test';
    const mockExifData = { createdDate: undefined, coordinates: undefined };
    const { extractExifData } = await import('$lib/services/utils/media/image/exif');

    vi.mocked(extractExifData).mockResolvedValue(mockExifData);

    // Mock video element
    const mockVideo = {
      duration: 120,
      videoWidth: 1920,
      videoHeight: 1080,
      addEventListener: vi.fn((event, callback) => {
        if (event === 'loadedmetadata') {
          // Simulate metadata loaded
          setTimeout(callback, 0);
        }
      }),
      /**
       * Sets the src property to trigger video metadata load.
       * @param {string} value The video source URL.
       */
      set src(value) {
        // Trigger loadedmetadata event when src is set
      },
    };

    // Mock document.createElement
    vi.stubGlobal('document', {
      createElement: vi.fn((tagName) => {
        if (tagName === 'video') {
          return mockVideo;
        }

        return {};
      }),
    });

    const result = await getMediaMetadata(mockAsset, mockSrc, 'video');

    expect(result).toEqual({
      dimensions: { width: 1920, height: 1080 },
      duration: 120,
      createdDate: undefined,
      coordinates: undefined,
    });

    expect(extractExifData).toHaveBeenCalledWith(mockAsset, 'video');
  });

  test('should get metadata for audio', async () => {
    const mockAsset = /** @type {any} */ ({
      file: new File([''], 'test.mp3', { type: 'audio/mpeg' }),
      name: 'test.mp3',
      path: '/test.mp3',
      sha: 'abc123',
      size: 3000,
      collectionName: 'test',
      folder: '/',
      kind: 'audio',
    });

    const mockSrc = 'data:audio/mpeg;base64,test';
    const mockExifData = { createdDate: undefined, coordinates: undefined };
    const { extractExifData } = await import('$lib/services/utils/media/image/exif');

    vi.mocked(extractExifData).mockResolvedValue(mockExifData);

    // Mock audio element
    const mockAudio = {
      duration: 240,
      addEventListener: vi.fn((event, callback) => {
        if (event === 'loadedmetadata') {
          // Simulate metadata loaded
          setTimeout(callback, 0);
        }
      }),
      /**
       * Sets the src property to trigger audio metadata load.
       * @param {string} value The audio source URL.
       */
      set src(value) {
        // Trigger loadedmetadata event when src is set
      },
    };

    // Mock document.createElement
    vi.stubGlobal('document', {
      createElement: vi.fn((tagName) => {
        if (tagName === 'audio') {
          return mockAudio;
        }

        return {};
      }),
    });

    const result = await getMediaMetadata(mockAsset, mockSrc, 'audio');

    expect(result).toEqual({
      dimensions: undefined,
      duration: 240,
      createdDate: undefined,
      coordinates: undefined,
    });

    expect(extractExifData).toHaveBeenCalledWith(mockAsset, 'audio');
  });

  test('should handle image load errors gracefully', async () => {
    const mockAsset = /** @type {any} */ ({
      file: new File([''], 'test.jpg', { type: 'image/jpeg' }),
      name: 'test.jpg',
      path: '/test.jpg',
      sha: 'abc123',
      size: 1000,
      collectionName: 'test',
      folder: '/',
      kind: 'image',
    });

    const mockSrc = 'data:image/jpeg;base64,invalid';
    const mockExifData = { createdDate: undefined, coordinates: undefined };
    const { extractExifData } = await import('$lib/services/utils/media/image/exif');

    vi.mocked(extractExifData).mockResolvedValue(mockExifData);

    // Mock Image with no dimensions (failed load)
    /**
     * Mock global Image constructor.
     * @returns {object} Mock image with 0 dimensions.
     */
    // @ts-ignore
    global.Image = function Image() {
      return createMockImage(0, 0);
    };

    const result = await getMediaMetadata(mockAsset, mockSrc, 'image');

    expect(result).toEqual({
      dimensions: { width: 0, height: 0 },
      duration: undefined,
      createdDate: undefined,
      coordinates: undefined,
    });
  });
});
