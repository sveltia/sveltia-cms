import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// Mock dependencies before importing the module
vi.mock('$lib/services/app/dependencies', () => ({
  getUnpkgURL: vi.fn((pkg) => `https://unpkg.com/${pkg}`),
}));

vi.mock('$lib/services/utils/media/image/encode', () => ({
  exportCanvasAsBlob: vi.fn(),
}));

vi.mock('$lib/services/utils/media/image/resize', () => ({
  resizeCanvas: vi.fn(),
}));

describe('renderPDF', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    /**
     * Mock URL class with static methods.
     */
    class MockURL {
      /**
       * Constructor for MockURL.
       * @param {string} url URL string.
       */
      constructor(url) {
        this.href = url;
      }
    }

    MockURL.createObjectURL = vi.fn(() => 'blob:mock-url');
    MockURL.revokeObjectURL = vi.fn();

    global.URL = /** @type {any} */ (MockURL);

    /**
     * Mock OffscreenCanvas class.
     */
    class MockOffscreenCanvas {
      /**
       * Get the rendering context.
       * @param {string} _contextType Context type.
       * @returns {object} Rendering context.
       */
      getContext(_contextType) {
        return {};
      }
    }

    global.OffscreenCanvas = /** @type {any} */ (MockOffscreenCanvas);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should render PDF successfully with default options', async () => {
    const { renderPDF } = await import('./pdf');
    const mockBlob = new Blob(['test pdf content'], { type: 'application/pdf' });
    const mockResultBlob = new Blob(['rendered image'], { type: 'image/png' });

    // Mock PDF.js modules
    const mockPDFJS = {
      GlobalWorkerOptions: { workerSrc: '' },
      getDocument: vi.fn(() => ({
        promise: Promise.resolve({
          getPage: vi.fn(() =>
            Promise.resolve({
              getViewport: vi.fn(() => ({
                width: 800,
                height: 600,
                scale: 1,
              })),
              render: vi.fn(() => ({
                promise: Promise.resolve(),
              })),
            }),
          ),
        }),
      })),
    };

    // Mock dynamic import
    vi.doMock('https://unpkg.com/pdfjs-dist/build/pdf.min.mjs', () => mockPDFJS);

    const { exportCanvasAsBlob } = await import('$lib/services/utils/media/image/encode');
    const { resizeCanvas } = await import('$lib/services/utils/media/image/resize');

    vi.mocked(exportCanvasAsBlob).mockResolvedValue(mockResultBlob);
    vi.mocked(resizeCanvas).mockReturnValue({ scale: 1, width: 800, height: 600 });

    const result = await renderPDF(mockBlob);

    expect(result).toBe(mockResultBlob);
    expect(global.URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  test('should handle custom options', async () => {
    const { renderPDF } = await import('./pdf');
    const mockBlob = new Blob(['test pdf content'], { type: 'application/pdf' });
    const mockResultBlob = new Blob(['rendered image'], { type: 'image/jpeg' });

    // Mock PDF.js modules
    const mockPDFJS = {
      GlobalWorkerOptions: { workerSrc: '' },
      getDocument: vi.fn(() => ({
        promise: Promise.resolve({
          getPage: vi.fn(() =>
            Promise.resolve({
              getViewport: vi.fn(() => ({
                width: 800,
                height: 600,
                scale: 1,
              })),
              render: vi.fn(() => ({
                promise: Promise.resolve(),
              })),
            }),
          ),
        }),
      })),
    };

    vi.doMock('https://unpkg.com/pdfjs-dist/build/pdf.min.mjs', () => mockPDFJS);

    const { exportCanvasAsBlob } = await import('$lib/services/utils/media/image/encode');
    const { resizeCanvas } = await import('$lib/services/utils/media/image/resize');

    vi.mocked(exportCanvasAsBlob).mockResolvedValue(mockResultBlob);
    vi.mocked(resizeCanvas).mockReturnValue({ scale: 0.5, width: 400, height: 300 });

    const result = await renderPDF(mockBlob, {
      format: 'jpeg',
      quality: 95,
      width: 400,
      height: 300,
    });

    expect(result).toBe(mockResultBlob);
    expect(exportCanvasAsBlob).toHaveBeenCalledWith(expect.any(Object), {
      format: 'jpeg',
      quality: 95,
    });
  });

  test('should handle library loading failure', async () => {
    // Reset modules to get a fresh instance without cached pdfjs
    vi.resetModules();

    // Re-mock dependencies after reset
    vi.doMock('$lib/services/app/dependencies', () => ({
      getUnpkgURL: vi.fn((pkg) => `https://unpkg.com/${pkg}-fail`),
    }));

    vi.doMock('$lib/services/utils/media/image/encode', () => ({
      exportCanvasAsBlob: vi.fn(),
    }));

    vi.doMock('$lib/services/utils/media/image/resize', () => ({
      resizeCanvas: vi.fn(),
    }));

    // Import a fresh instance of renderPDF
    const { renderPDF } = await import('./pdf');
    const mockBlob = new Blob(['test pdf content'], { type: 'application/pdf' });

    // Test that it throws the correct error when PDF.js fails to load
    await expect(renderPDF(mockBlob)).rejects.toThrow('Failed to load PDF.js library');
  });

  test('should handle PDF rendering failure', async () => {
    // Reset modules completely to get a fresh pdf.js import
    vi.resetModules();

    // Re-establish all mocks
    vi.doMock('$lib/services/app/dependencies', () => ({
      getUnpkgURL: vi.fn((pkg) => `https://unpkg.com/${pkg}`),
    }));

    vi.doMock('$lib/services/utils/media/image/encode', () => ({
      exportCanvasAsBlob: vi.fn(),
    }));

    vi.doMock('$lib/services/utils/media/image/resize', () => ({
      resizeCanvas: vi.fn(() => ({ scale: 1, width: 800, height: 600 })),
    }));

    // Mock PDF.js to throw an error during document loading
    vi.doMock('https://unpkg.com/pdfjs-dist/build/pdf.min.mjs', () => ({
      default: {
        GlobalWorkerOptions: { workerSrc: '' },
        getDocument: vi.fn(() => ({
          promise: Promise.reject(new Error('Invalid PDF document')),
        })),
      },
      GlobalWorkerOptions: { workerSrc: '' },
      getDocument: vi.fn(() => ({
        promise: Promise.reject(new Error('Invalid PDF document')),
      })),
    }));

    const { renderPDF } = await import('./pdf');
    const mockBlob = new Blob(['test pdf content'], { type: 'application/pdf' });

    // Should throw "Failed to render PDF" when PDF processing fails
    await expect(renderPDF(mockBlob)).rejects.toThrow('Failed to render PDF');
  });

  test('should handle PDF page rendering failure', async () => {
    // Reset modules completely to get a fresh pdf.js import
    vi.resetModules();

    // Re-establish all mocks
    vi.doMock('$lib/services/app/dependencies', () => ({
      getUnpkgURL: vi.fn((pkg) => `https://unpkg.com/${pkg}`),
    }));

    vi.doMock('$lib/services/utils/media/image/encode', () => ({
      exportCanvasAsBlob: vi.fn(),
    }));

    vi.doMock('$lib/services/utils/media/image/resize', () => ({
      resizeCanvas: vi.fn(() => ({ scale: 1, width: 800, height: 600 })),
    }));

    // Mock PDF.js with render failure
    vi.doMock('https://unpkg.com/pdfjs-dist/build/pdf.min.mjs', () => ({
      default: {
        GlobalWorkerOptions: { workerSrc: '' },
        getDocument: vi.fn(() => ({
          promise: Promise.resolve({
            getPage: vi.fn(() =>
              Promise.resolve({
                getViewport: vi.fn(() => ({ width: 800, height: 600 })),
                render: vi.fn(() => ({
                  promise: Promise.reject(new Error('Render failed')),
                })),
              }),
            ),
          }),
        })),
      },
      GlobalWorkerOptions: { workerSrc: '' },
      getDocument: vi.fn(() => ({
        promise: Promise.resolve({
          getPage: vi.fn(() =>
            Promise.resolve({
              getViewport: vi.fn(() => ({ width: 800, height: 600 })),
              render: vi.fn(() => ({
                promise: Promise.reject(new Error('Render failed')),
              })),
            }),
          ),
        }),
      })),
    }));

    const { renderPDF } = await import('./pdf');
    const mockBlob = new Blob(['test pdf content'], { type: 'application/pdf' });

    // Should throw "Failed to render PDF" when rendering fails
    await expect(renderPDF(mockBlob)).rejects.toThrow('Failed to render PDF');
  });
});
