import { loadModule } from '$lib/services/app/dependencies';
import { exportCanvasAsBlob } from '$lib/services/utils/media/image/encode';
import { resolveTransformOptions } from '$lib/services/utils/media/image/options';
import { resizeCanvas } from '$lib/services/utils/media/image/resize';
import { createLoadingOptions } from '$lib/services/utils/media/pdf-options';

/**
 * @import { InternalImageTransformationOptions } from '$lib/types/private';
 */

/**
 * Placeholder for the PDF.js module.
 * @type {import('pdfjs-dist')}
 */
let pdfjs;

/**
 * Create a thumbnail image of a PDF document using PDF.js.
 * @param {File | Blob} blob Source file.
 * @param {InternalImageTransformationOptions} [options] Options.
 * @returns {Promise<Blob>} Thumbnail blob.
 * @throws {Error} When the rendering failed.
 * @see https://github.com/mozilla/pdf.js/blob/master/examples/webpack/main.mjs
 * @see https://github.com/mozilla/pdf.js/issues/10478
 */
export const renderPDF = async (blob, options = {}) => {
  const { format, quality, width, height, fit, nativeOnly } = resolveTransformOptions(options);

  // Lazily load the PDF.js library
  if (!pdfjs) {
    try {
      pdfjs = await loadModule('pdfjs-dist', 'build/pdf.min.mjs');
    } catch {
      throw new Error('Failed to load PDF.js library');
    }
  }

  const url = URL.createObjectURL(blob);
  const canvas = new OffscreenCanvas(512, 512);
  const context = /** @type {OffscreenCanvasRenderingContext2D} */ (canvas.getContext('2d'));
  // Without a `worker` option, every document gets a Web Worker of its own, which is only
  // terminated when the loading task is destroyed. A thumbnail is rendered once, so the task has to
  // be destroyed right after, or each PDF would leave a worker thread running for the rest of the
  // session, holding the parsed document in memory. A worker passed in the options is ended by
  // `dispose()` instead
  /** @type {import('pdfjs-dist').PDFDocumentLoadingTask | undefined} */
  let loadingTask;
  /** @type {ReturnType<typeof createLoadingOptions> | undefined} */
  let loadingOptions;

  try {
    loadingOptions = createLoadingOptions(pdfjs);
    loadingTask = pdfjs.getDocument({ disableAutoFetch: true, ...loadingOptions.options, url });

    const pdfDocument = await loadingTask.promise;
    const pdfPage = await pdfDocument.getPage(1);
    const viewport = pdfPage.getViewport({ scale: 1 });

    const { scale } = resizeCanvas(
      canvas,
      { width: viewport.width, height: viewport.height },
      { width, height, fit },
    );

    await pdfPage.render({
      // @ts-ignore `OffscreenCanvas` is supported
      canvasContext: context,
      viewport: scale === 1 ? viewport : pdfPage.getViewport({ scale }),
    }).promise;
  } catch {
    throw new Error('Failed to render PDF');
  } finally {
    URL.revokeObjectURL(url);

    try {
      await loadingTask?.destroy();
    } catch {
      // The page has been rendered onto the canvas, or the rendering has already failed, so a
      // failure to clean up changes nothing for the caller
    }

    loadingOptions?.dispose?.();
  }

  return exportCanvasAsBlob(canvas, { format, quality, nativeOnly });
};
