import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('$lib/services/app/dependencies', () => ({
  loadModule: vi.fn(),
}));

vi.mock('$lib/services/utils/media/image/encode', () => ({
  exportCanvasAsBlob: vi.fn(),
}));

vi.mock('$lib/services/utils/media/image/resize', () => ({
  resizeCanvas: vi.fn(),
}));

vi.mock('$lib/services/utils/media/pdf-options', () => ({
  createLoadingOptions: vi.fn(),
}));

/**
 * Import a fresh `renderPDF`, which keeps the loaded PDF.js module in module state, with a mocked
 * PDF.js whose `getDocument()` is the given function.
 * @param {(...args: any[]) => any} getDocument `getDocument()` implementation.
 * @param {object} [args] Arguments.
 * @param {(() => void) | undefined} [args.dispose] `dispose()` returned with the loading options.
 * @returns {Promise<{ renderPDF: typeof import('./pdf').renderPDF, pdfjs: any }>} `renderPDF` and
 * the mocked PDF.js module.
 */
const importWithPDFJS = async (getDocument, { dispose } = {}) => {
  vi.resetModules();

  const { loadModule } = await import('$lib/services/app/dependencies');
  const { exportCanvasAsBlob } = await import('$lib/services/utils/media/image/encode');
  const { resizeCanvas } = await import('$lib/services/utils/media/image/resize');
  const { createLoadingOptions } = await import('$lib/services/utils/media/pdf-options');
  const pdfjs = { getDocument: vi.fn(getDocument) };

  vi.mocked(loadModule).mockResolvedValue(pdfjs);
  vi.mocked(exportCanvasAsBlob).mockResolvedValue(new Blob(['png'], { type: 'image/png' }));
  vi.mocked(resizeCanvas).mockReturnValue({ scale: 1, width: 800, height: 600 });
  vi.mocked(createLoadingOptions).mockReturnValue({ options: { cMapUrl: 'cmaps/' }, dispose });

  return { renderPDF: (await import('./pdf')).renderPDF, pdfjs };
};

/**
 * Create a mocked PDF page.
 * @param {Promise<void>} [renderPromise] Promise returned by `render()`.
 * @returns {any} Page.
 */
const createPage = (renderPromise = Promise.resolve()) => ({
  getViewport: vi.fn(({ scale }) => ({ width: 800 * scale, height: 600 * scale, scale })),
  render: vi.fn(() => ({ promise: renderPromise })),
});

/**
 * Create a mocked loading task for a document with the given page.
 * @param {any} page Page.
 * @returns {any} Loading task.
 */
const createTask = (page) => ({
  promise: Promise.resolve({ getPage: vi.fn(async () => page) }),
  destroy: vi.fn(() => Promise.resolve()),
});

describe('renderPDF', () => {
  beforeEach(() => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    /**
     * Mock `OffscreenCanvas`.
     */
    class MockOffscreenCanvas {
      /**
       * Get the rendering context.
       * @returns {object} Rendering context.
       */
      getContext() {
        return {};
      }
    }

    vi.stubGlobal('OffscreenCanvas', MockOffscreenCanvas);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test('renders the first page with the loading options', async () => {
    const page = createPage();
    const task = createTask(page);
    const { renderPDF, pdfjs } = await importWithPDFJS(() => task);
    const { loadModule } = await import('$lib/services/app/dependencies');
    const { exportCanvasAsBlob } = await import('$lib/services/utils/media/image/encode');
    const blob = new Blob(['pdf'], { type: 'application/pdf' });

    await expect(renderPDF(blob)).resolves.toBeInstanceOf(Blob);
    expect(loadModule).toHaveBeenCalledWith('pdfjs-dist', 'build/pdf.min.mjs');
    expect(pdfjs.getDocument).toHaveBeenCalledWith({
      disableAutoFetch: true,
      cMapUrl: 'cmaps/',
      url: 'blob:mock-url',
    });
    expect(page.render).toHaveBeenCalledWith({
      canvasContext: {},
      viewport: { width: 800, height: 600, scale: 1 },
    });
    expect(exportCanvasAsBlob).toHaveBeenCalledWith(expect.any(Object), {
      format: 'png',
      quality: 85,
      nativeOnly: false,
    });
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  test('renders the page at a smaller scale with custom options', async () => {
    const page = createPage();
    const { renderPDF } = await importWithPDFJS(() => createTask(page));
    const { exportCanvasAsBlob } = await import('$lib/services/utils/media/image/encode');
    const { resizeCanvas } = await import('$lib/services/utils/media/image/resize');

    vi.mocked(resizeCanvas).mockReturnValue({ scale: 0.5, width: 400, height: 300 });

    await renderPDF(new Blob(['pdf']), { format: 'jpeg', quality: 95, width: 400, height: 300 });

    expect(page.render).toHaveBeenCalledWith({
      canvasContext: {},
      viewport: { width: 400, height: 300, scale: 0.5 },
    });
    expect(exportCanvasAsBlob).toHaveBeenCalledWith(expect.any(Object), {
      format: 'jpeg',
      quality: 95,
      nativeOnly: false,
    });
  });

  test('loads PDF.js only once', async () => {
    const page = createPage();
    const { renderPDF } = await importWithPDFJS(() => createTask(page));
    const { loadModule } = await import('$lib/services/app/dependencies');

    await renderPDF(new Blob(['pdf']));
    await renderPDF(new Blob(['pdf']));

    expect(loadModule).toHaveBeenCalledOnce();
  });

  test('throws when PDF.js fails to load', async () => {
    const { renderPDF } = await importWithPDFJS(() => createTask(createPage()));
    const { loadModule } = await import('$lib/services/app/dependencies');

    vi.mocked(loadModule).mockRejectedValue(new Error('Network error'));

    await expect(renderPDF(new Blob(['pdf']))).rejects.toThrow('Failed to load PDF.js library');
  });

  test('throws when the page fails to render', async () => {
    const renderPromise = Promise.reject(new Error('Render failed'));

    renderPromise.catch(() => {});

    const { renderPDF } = await importWithPDFJS(() => createTask(createPage(renderPromise)));

    await expect(renderPDF(new Blob(['pdf']))).rejects.toThrow('Failed to render PDF');
  });

  describe('cleanup', () => {
    test('destroys the loading task, then disposes of the options, after a render', async () => {
      const task = createTask(createPage());
      /** @type {number[]} */
      const destroyCalls = [];

      const dispose = vi.fn(() => {
        destroyCalls.push(task.destroy.mock.calls.length);
      });

      const { renderPDF } = await importWithPDFJS(() => task, { dispose });

      await expect(renderPDF(new Blob(['pdf']))).resolves.toBeInstanceOf(Blob);
      // The loading task had been destroyed by the time the options were disposed of
      expect(destroyCalls).toEqual([1]);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });

    test('cleans up when the document fails to load', async () => {
      const destroy = vi.fn(() => Promise.resolve());
      const dispose = vi.fn();
      const promise = Promise.reject(new Error('Invalid PDF'));

      promise.catch(() => {});

      const { renderPDF } = await importWithPDFJS(() => ({ promise, destroy }), { dispose });

      await expect(renderPDF(new Blob(['pdf']))).rejects.toThrow('Failed to render PDF');
      expect(destroy).toHaveBeenCalledOnce();
      expect(dispose).toHaveBeenCalledOnce();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });

    test('ignores a failure to destroy the loading task', async () => {
      const dispose = vi.fn();

      const { renderPDF } = await importWithPDFJS(
        () => ({
          ...createTask(createPage()),
          destroy: vi.fn(() => Promise.reject(new Error('Worker gone'))),
        }),
        { dispose },
      );

      await expect(renderPDF(new Blob(['pdf']))).resolves.toBeInstanceOf(Blob);
      expect(dispose).toHaveBeenCalledOnce();
    });

    test('disposes of the options when the loading task cannot be created', async () => {
      const dispose = vi.fn();

      const { renderPDF } = await importWithPDFJS(
        () => {
          throw new Error('Bad parameters');
        },
        { dispose },
      );

      await expect(renderPDF(new Blob(['pdf']))).rejects.toThrow('Failed to render PDF');
      expect(dispose).toHaveBeenCalledOnce();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });

    test('revokes the URL when the loading options cannot be created', async () => {
      const { renderPDF, pdfjs } = await importWithPDFJS(() => createTask(createPage()));
      const { createLoadingOptions } = await import('$lib/services/utils/media/pdf-options');

      vi.mocked(createLoadingOptions).mockImplementation(() => {
        throw new Error('Worker not supported');
      });

      await expect(renderPDF(new Blob(['pdf']))).rejects.toThrow('Failed to render PDF');
      expect(pdfjs.getDocument).not.toHaveBeenCalled();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });
  });
});
