import { getUnpkgURL } from '$lib/services/app/dependencies';

/**
 * PDF.js distribution URL. The CDN builds don’t bundle the library due to the large size and
 * multiple files. However, having it as a dependency in `package.json` allows us to include the
 * latest version in the UNPKG URL, making it faster to load the script without waiting for a
 * redirect. The npm build replaces this module with `pdf-options.npm.js`.
 * @see https://github.com/mozilla/pdf.js
 */
const PDFJS_DIST_URL = getUnpkgURL('pdfjs-dist');
const PDFJS_WORKER_URL = `${PDFJS_DIST_URL}/build/pdf.worker.min.mjs`;

/**
 * Options for `getDocument()` pointing PDF.js to its data files on UNPKG.
 */
const PDFJS_GET_DOC_OPTIONS = {
  cMapUrl: `${PDFJS_DIST_URL}/cmaps/`,
  iccUrl: `${PDFJS_DIST_URL}/iccs/`,
  standardFontDataUrl: `${PDFJS_DIST_URL}/standard_fonts/`,
  wasmUrl: `${PDFJS_DIST_URL}/wasm/`,
};

/**
 * Get the options for loading a PDF document with PDF.js from UNPKG. The worker is loaded from the
 * same place, and created by PDF.js for each document.
 * @param {import('pdfjs-dist')} pdfjs PDF.js module.
 * @returns {{ options: Record<string, any>, dispose?: () => void }} Options for `getDocument()`,
 * and a function to clean up once the loading task has been destroyed, which isn’t needed here.
 */
export const createLoadingOptions = (pdfjs) => {
  pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;

  return { options: PDFJS_GET_DOC_OPTIONS };
};
