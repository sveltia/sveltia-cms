import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies
vi.mock('$lib/services/app/dependencies', () => ({
  loadModule: vi.fn(),
}));

vi.mock('$lib/services/utils/media/image/encode', () => ({
  exportCanvasAsBlob: vi.fn(),
}));

vi.mock('$lib/services/utils/media/image/resize', () => ({
  resizeCanvas: vi.fn(),
}));

describe('Image Transform Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock HTMLVideoElement first
    global.HTMLVideoElement = vi.fn();

    // Mock global URL object
    global.URL = /** @type {any} */ ({
      createObjectURL: vi.fn(() => 'blob:mock-url'),
      revokeObjectURL: vi.fn(),
    });

    // Mock global Image constructor
    global.Image = /** @type {any} */ (
      vi.fn(() => ({
        addEventListener: vi.fn((event, callback) => {
          if (event === 'load') {
            setTimeout(callback, 0);
          }
        }),
        naturalWidth: 800,
        naturalHeight: 600,
        /**
         * Sets the src property to trigger image load.
         * @param {string} _value The image source URL.
         */
        set src(_value) {
          // Trigger load event when src is set
        },
      }))
    );

    // Mock document and createElement for video
    global.document = /** @type {any} */ ({
      createElement: vi.fn((tagName) => {
        if (tagName === 'video') {
          const videoElement = {
            addEventListener: vi.fn((event, callback) => {
              if (event === 'canplay') {
                setTimeout(callback, 0);
              }
            }),
            pause: vi.fn(),
            videoWidth: 1920,
            videoHeight: 1080,
            /**
             * Sets the src property to trigger video canplay.
             * @param {string} _value The video source URL.
             */
            set src(_value) {
              // Trigger canplay event when src is set
            },
            style: {},
            muted: false,
            autoplay: false,
            playsInline: false,
          };

          // Make it an instance of HTMLVideoElement
          Object.setPrototypeOf(videoElement, global.HTMLVideoElement.prototype);

          return videoElement;
        }

        return {};
      }),
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      },
    });

    // Mock global createImageBitmap
    global.createImageBitmap = vi.fn().mockResolvedValue({
      width: 800,
      height: 600,
    });

    // Mock OffscreenCanvas
    global.OffscreenCanvas = /** @type {any} */ (
      vi.fn((width, height) => ({
        width,
        height,
        getContext: vi.fn(() => ({
          drawImage: vi.fn(),
        })),
      }))
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should export required functions', async () => {
    const module = await import('./transform.js');

    expect(module.createImageSource).toBeDefined();
    expect(module.createVideoSource).toBeDefined();
    expect(module.createSource).toBeDefined();
    expect(module.transformImage).toBeDefined();
    expect(module.optimizeSVG).toBeDefined();
  });

  test('optimizeSVG should handle SVGO optimization', async () => {
    const originalSVG = '<svg><rect /></svg>';
    const optimizedSVG = '<svg><rect/></svg>';
    const mockBlob = new Blob([originalSVG], { type: 'image/svg+xml' });

    const mockSVGO = {
      optimize: vi.fn().mockReturnValue({ data: optimizedSVG }),
    };

    const { loadModule } = await import('$lib/services/app/dependencies');
    const { optimizeSVG } = await import('./transform.js');

    vi.mocked(loadModule).mockResolvedValue(mockSVGO);

    const result = await optimizeSVG(mockBlob);

    expect(loadModule).toHaveBeenCalledWith('svgo', 'dist/svgo.browser.js');
    expect(mockSVGO.optimize).toHaveBeenCalledWith(originalSVG);
    expect(result).toBeInstanceOf(Blob);
    expect(result.type).toBe('image/svg+xml');
  });

  test('optimizeSVG should return original blob when SVGO fails', async () => {
    const originalSVG = '<svg><rect /></svg>';
    const mockBlob = new Blob([originalSVG], { type: 'image/svg+xml' });
    const { loadModule } = await import('$lib/services/app/dependencies');
    const { optimizeSVG } = await import('./transform.js');

    vi.mocked(loadModule).mockRejectedValue(new Error('SVGO failed'));

    const result = await optimizeSVG(mockBlob);

    expect(result).toBe(mockBlob);
  });

  test('optimizeSVG should handle text extraction errors', async () => {
    // Create a blob that will cause text extraction to fail
    const mockBlob = /** @type {any} */ ({
      type: 'image/svg+xml',
      text: vi.fn().mockRejectedValue(new Error('Text extraction failed')),
    });

    const { optimizeSVG } = await import('./transform.js');

    // Since the function doesn't handle text extraction errors,
    // it should reject with the original error
    await expect(optimizeSVG(mockBlob)).rejects.toThrow('Text extraction failed');
  });

  test('createImageSource should create image source from blob', async () => {
    const mockBlob = new Blob(['image data'], { type: 'image/png' });
    const { createImageSource } = await import('./transform.js');
    const result = await createImageSource({ blob: mockBlob });

    expect(global.URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
    expect(result).toEqual({
      source: expect.any(Object),
      naturalWidth: 800,
      naturalHeight: 600,
    });
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  test('createVideoSource should create video source from blob', async () => {
    const mockBlob = new Blob(['video data'], { type: 'video/mp4' });
    const { createVideoSource } = await import('./transform.js');
    const result = await createVideoSource({ blob: mockBlob });

    expect(global.URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
    expect(global.document.createElement).toHaveBeenCalledWith('video');
    expect(global.document.body.appendChild).toHaveBeenCalled();
    expect(result).toEqual({
      source: expect.any(Object),
      naturalWidth: 1920,
      naturalHeight: 1080,
    });
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  test('createSource should delegate to createVideoSource for video blobs', async () => {
    const mockBlob = new Blob(['video data'], { type: 'video/mp4' });
    const { createSource } = await import('./transform.js');
    const result = await createSource(mockBlob);

    expect(global.document.createElement).toHaveBeenCalledWith('video');
    expect(result.naturalWidth).toBe(1920);
    expect(result.naturalHeight).toBe(1080);
  });

  test('createSource should delegate to createImageSource for image blobs', async () => {
    const mockBlob = new Blob(['image data'], { type: 'image/png' });
    const { createSource } = await import('./transform.js');
    const result = await createSource(mockBlob);

    expect(global.Image).toHaveBeenCalled();
    expect(result.naturalWidth).toBe(800);
    expect(result.naturalHeight).toBe(600);
  });

  test('transformImage should transform image using createImageBitmap path', async () => {
    const mockBlob = new Blob(['image data'], { type: 'image/png' });
    const mockResultBlob = new Blob(['transformed'], { type: 'image/png' });
    const { exportCanvasAsBlob } = await import('$lib/services/utils/media/image/encode');
    const { resizeCanvas } = await import('$lib/services/utils/media/image/resize');
    const { transformImage } = await import('./transform.js');

    vi.mocked(exportCanvasAsBlob).mockResolvedValue(mockResultBlob);
    vi.mocked(resizeCanvas).mockReturnValue({ scale: 1, width: 800, height: 600 });

    const result = await transformImage(mockBlob, { format: 'jpeg', quality: 90 });

    expect(global.createImageBitmap).toHaveBeenCalledWith(mockBlob);
    expect(resizeCanvas).toHaveBeenCalled();
    expect(exportCanvasAsBlob).toHaveBeenCalledWith(expect.any(Object), {
      format: 'jpeg',
      quality: 90,
    });
    expect(result).toBe(mockResultBlob);
  });

  test('transformImage should fall back to createSource when createImageBitmap fails', async () => {
    const mockBlob = new Blob(['svg data'], { type: 'image/svg+xml' });
    const mockResultBlob = new Blob(['transformed'], { type: 'image/png' });
    const { exportCanvasAsBlob } = await import('$lib/services/utils/media/image/encode');
    const { resizeCanvas } = await import('$lib/services/utils/media/image/resize');
    const { transformImage } = await import('./transform.js');

    // Make createImageBitmap fail for SVG
    vi.mocked(global.createImageBitmap).mockRejectedValue(new Error('SVG not supported'));
    vi.mocked(exportCanvasAsBlob).mockResolvedValue(mockResultBlob);
    vi.mocked(resizeCanvas).mockReturnValue({ scale: 1, width: 800, height: 600 });

    const result = await transformImage(mockBlob);

    expect(global.createImageBitmap).toHaveBeenCalledWith(mockBlob);
    expect(global.Image).toHaveBeenCalled(); // Fallback to createImageSource
    expect(result).toBe(mockResultBlob);
  });

  test('transformImage should handle video source and clean up', async () => {
    const mockBlob = new Blob(['video data'], { type: 'video/mp4' });
    const mockResultBlob = new Blob(['transformed'], { type: 'image/png' });
    const { exportCanvasAsBlob } = await import('$lib/services/utils/media/image/encode');
    const { resizeCanvas } = await import('$lib/services/utils/media/image/resize');
    const { transformImage } = await import('./transform.js');

    // Make createImageBitmap fail to force createSource path
    vi.mocked(global.createImageBitmap).mockRejectedValue(new Error('Not supported'));
    vi.mocked(exportCanvasAsBlob).mockResolvedValue(mockResultBlob);
    vi.mocked(resizeCanvas).mockReturnValue({ scale: 1, width: 1920, height: 1080 });

    const result = await transformImage(mockBlob);

    expect(global.createImageBitmap).toHaveBeenCalledWith(mockBlob);
    expect(global.document.createElement).toHaveBeenCalledWith('video');
    expect(global.document.body.appendChild).toHaveBeenCalled();
    expect(global.document.body.removeChild).toHaveBeenCalled();
    expect(result).toBe(mockResultBlob);
  });

  test('transformImage should use default options when none provided', async () => {
    const mockBlob = new Blob(['image data'], { type: 'image/png' });
    const mockResultBlob = new Blob(['transformed'], { type: 'image/png' });
    const { exportCanvasAsBlob } = await import('$lib/services/utils/media/image/encode');
    const { transformImage } = await import('./transform.js');

    vi.mocked(exportCanvasAsBlob).mockResolvedValue(mockResultBlob);

    const result = await transformImage(mockBlob);

    expect(exportCanvasAsBlob).toHaveBeenCalledWith(expect.any(Object), {
      format: 'png',
      quality: 85,
    });
    expect(result).toBe(mockResultBlob);
  });

  test('optimizeSVG should handle SVGO optimization', async () => {
    const originalSVG = '<svg><rect /></svg>';
    const optimizedSVG = '<svg><rect/></svg>';
    const mockBlob = new Blob([originalSVG], { type: 'image/svg+xml' });

    const mockSVGO = {
      optimize: vi.fn().mockReturnValue({ data: optimizedSVG }),
    };

    const { loadModule } = await import('$lib/services/app/dependencies');
    const { optimizeSVG } = await import('./transform.js');

    vi.mocked(loadModule).mockResolvedValue(mockSVGO);

    const result = await optimizeSVG(mockBlob);

    expect(loadModule).toHaveBeenCalledWith('svgo', 'dist/svgo.browser.js');
    expect(mockSVGO.optimize).toHaveBeenCalledWith(originalSVG);
    expect(result).toBeInstanceOf(Blob);
    expect(result.type).toBe('image/svg+xml');
  });

  test('optimizeSVG should return original blob when SVGO fails', async () => {
    const originalSVG = '<svg><rect /></svg>';
    const mockBlob = new Blob([originalSVG], { type: 'image/svg+xml' });
    const { loadModule } = await import('$lib/services/app/dependencies');
    const { optimizeSVG } = await import('./transform.js');

    vi.mocked(loadModule).mockRejectedValue(new Error('SVGO failed'));

    const result = await optimizeSVG(mockBlob);

    expect(result).toBe(mockBlob);
  });

  test('optimizeSVG should handle text extraction errors', async () => {
    // Create a blob that will cause text extraction to fail
    const mockBlob = /** @type {any} */ ({
      type: 'image/svg+xml',
      text: vi.fn().mockRejectedValue(new Error('Text extraction failed')),
    });

    const { optimizeSVG } = await import('./transform.js');

    // Since the function doesn't handle text extraction errors,
    // it should reject with the original error
    await expect(optimizeSVG(mockBlob)).rejects.toThrow('Text extraction failed');
  });
});
