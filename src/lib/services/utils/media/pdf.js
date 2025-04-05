import { getUnpkgURL } from '$lib/services/app/dependencies';
import { exportCanvasAsBlob, resizeCanvas } from '$lib/services/utils/media/image';

/**
 * @import { InternalImageTransformationOptions } from '$lib/types/private';
 */

/**
 * PDF.js distribution URL. We don’t bundle the library due to the large size and multiple files.
 * However, having it as a dependency in `package.json` allows us to include the latest version in
 * the UNPKG URL, making it faster to load the script without waiting for a redirect.
 * @see https://github.com/mozilla/pdf.js
 */
const pdfjsDistURL = getUnpkgURL('pdfjs-dist');
const pdfjsModuleURL = `${pdfjsDistURL}/build/pdf.min.mjs`;
const pdfjsWorkerURL = `${pdfjsDistURL}/build/pdf.worker.min.mjs`;

const pdfjsGetDocOptions = {
  isEvalSupported: false,
  disableAutoFetch: true,
  cMapUrl: `${pdfjsDistURL}/cmaps/`,
  iccUrl: `${pdfjsDistURL}/iccs/`,
  standardFontDataUrl: `${pdfjsDistURL}/standard_fonts/`,
  wasmUrl: `${pdfjsDistURL}/wasm/`,
};

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
export const renderPDF = async (
  blob,
  { format = 'png', quality = 85, width = undefined, height = undefined, fit = 'scale-down' } = {},
) => {
  // Lazily load the PDF.js library
  if (!pdfjs) {
    try {
      pdfjs = await import(/* @vite-ignore */ pdfjsModuleURL);
      pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorkerURL;
    } catch {
      throw new Error('Failed to load PDF.js library');
    }
  }

  const url = URL.createObjectURL(blob);
  const canvas = new OffscreenCanvas(512, 512);
  const context = /** @type {OffscreenCanvasRenderingContext2D} */ (canvas.getContext('2d'));

  try {
    const pdfDocument = await pdfjs.getDocument({ ...pdfjsGetDocOptions, url }).promise;
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

    URL.revokeObjectURL(url);
  } catch {
    throw new Error('Failed to render PDF');
  }

  return exportCanvasAsBlob(canvas, { format, quality });
};
