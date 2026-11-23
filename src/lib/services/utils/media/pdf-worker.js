/**
 * Module worker running PDF.js in the npm build, where the worker is bundled rather than loaded
 * from UNPKG. The PDF.js worker starts listening to the main thread as soon as it’s evaluated. It’s
 * imported statically, so the worker is a self-contained file a consumer’s bundler can copy as is,
 * like `heic-worker.js`.
 */
import 'pdfjs-dist/build/pdf.worker.min.mjs';
