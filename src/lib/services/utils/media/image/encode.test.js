import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { exportCanvasAsBlob } from './encode';

// Mock dependencies
vi.mock('$lib/services/app/dependencies', () => ({
  loadModule: vi.fn(),
}));

vi.mock('$lib/services/utils/media/image', () => ({
  RASTER_IMAGE_CONVERSION_FORMATS: ['webp', 'jpeg', 'png', 'avif'],
}));

// Mock the checkIfEncodingIsSupported function
// We'll mock this inline in tests as needed

describe('exportCanvasAsBlob', () => {
  /** @type {any} */
  let mockCanvas;
  /** @type {any} */
  let mockContext;

  beforeEach(() => {
    vi.clearAllMocks();

    mockContext = {
      getImageData: vi.fn(() => ({
        data: new Uint8ClampedArray(4),
        width: 1,
        height: 1,
      })),
    };

    mockCanvas = {
      width: 100,
      height: 100,
      getContext: vi.fn(() => mockContext),
      convertToBlob: vi.fn(),
    };

    // Mock OffscreenCanvas globally
    // @ts-ignore - Mock implementation doesn't need all properties
    global.OffscreenCanvas = vi.fn(() => ({
      getContext: vi.fn(() => mockContext),
      convertToBlob: vi.fn(() => Promise.resolve(new Blob([''], { type: 'image/webp' }))),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should use native canvas encoding when supported', async () => {
    const mockBlob = new Blob(['test'], { type: 'image/webp' });

    mockCanvas.convertToBlob.mockResolvedValue(mockBlob);

    const result = await exportCanvasAsBlob(mockCanvas, { format: 'webp', quality: 85 });

    expect(result).toBe(mockBlob);
    expect(mockCanvas.convertToBlob).toHaveBeenCalledWith({
      type: 'image/webp',
      quality: 0.85,
    });
  });

  test('should use default options when none provided', async () => {
    const mockBlob = new Blob(['test'], { type: 'image/webp' });

    mockCanvas.convertToBlob.mockResolvedValue(mockBlob);

    const result = await exportCanvasAsBlob(mockCanvas);

    expect(result).toBe(mockBlob);
    expect(mockCanvas.convertToBlob).toHaveBeenCalledWith({
      type: 'image/webp',
      quality: 0.85, // 85 / 100
    });
  });

  test('should handle jSquash fallback flow', async () => {
    const mockBlob = new Blob(['webp result'], { type: 'image/webp' });

    // Mock canvas to return a blob
    mockCanvas.convertToBlob.mockResolvedValue(mockBlob);

    // Test that the function returns a blob for webp format
    const result = await exportCanvasAsBlob(mockCanvas, { format: 'webp', quality: 90 });

    expect(result).toBeInstanceOf(Blob);
    expect(result.type).toBe('image/webp');
  });

  test('should handle jSquash fallback scenario', async () => {
    const mockLoadModule = vi.fn(() => Promise.reject(new Error('jSquash load failed')));
    const mockBlob = new Blob(['fallback'], { type: 'image/png' });
    const { loadModule } = await import('$lib/services/app/dependencies');

    vi.mocked(loadModule).mockImplementation(mockLoadModule);

    // Mock canvas to return the fallback blob when jSquash fails
    mockCanvas.convertToBlob.mockResolvedValue(mockBlob);

    const result = await exportCanvasAsBlob(mockCanvas, { format: 'webp', quality: 95 });

    expect(result).toBeInstanceOf(Blob);
    expect(result.type).toBe('image/png');
  });

  test('should handle PNG format', async () => {
    const mockBlob = new Blob(['test'], { type: 'image/png' });

    mockCanvas.convertToBlob.mockResolvedValue(mockBlob);

    const result = await exportCanvasAsBlob(mockCanvas, { format: 'png', quality: 100 });

    expect(result).toBe(mockBlob);
    expect(mockCanvas.convertToBlob).toHaveBeenCalledWith({
      type: 'image/png',
      quality: 1.0,
    });
  });

  test('should handle JPEG format', async () => {
    const mockBlob = new Blob(['test'], { type: 'image/jpeg' });

    mockCanvas.convertToBlob.mockResolvedValue(mockBlob);

    const result = await exportCanvasAsBlob(mockCanvas, { format: 'jpeg', quality: 75 });

    expect(result).toBe(mockBlob);
    expect(mockCanvas.convertToBlob).toHaveBeenCalledWith({
      type: 'image/jpeg',
      quality: 0.75,
    });
  });

  test('should skip jSquash for unsupported formats', async () => {
    const mockBlob = new Blob(['test'], { type: 'image/bmp' });

    mockCanvas.convertToBlob.mockResolvedValue(mockBlob);

    const result = await exportCanvasAsBlob(mockCanvas, { format: 'bmp', quality: 85 });

    expect(result).toBe(mockBlob);
    expect(mockCanvas.convertToBlob).toHaveBeenCalledWith({
      type: 'image/bmp',
      quality: 0.85,
    });
  });
});
