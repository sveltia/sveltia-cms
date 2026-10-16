import jbig2URL from 'pdfjs-dist/wasm/jbig2.wasm?url';
import openjpegURL from 'pdfjs-dist/wasm/openjpeg.wasm?url';

/**
 * URLs of the WebAssembly image decoders bundled with the npm build, keyed with the file name the
 * PDF.js worker asks for: JPEG 2000 and JBIG2 images would otherwise be left out of a thumbnail.
 * The character maps, standard fonts and ICC profiles aren’t bundled, as PDF.js comes with hundreds
 * of them; it falls back to system fonts and its built-in color conversion instead. The ICC color
 * management decoder, `qcms_bg.wasm`, isn’t either: PDF.js only loads it from `wasmUrl`, which
 * would also need the other decoders at fixed file names a consumer’s bundler wouldn’t keep.
 * @type {Record<string, string>}
 */
const WASM_URLS = {
  'jbig2.wasm': jbig2URL,
  'openjpeg.wasm': openjpegURL,
};

/**
 * Fetched WebAssembly files, keyed with the file name, shared by every document, as each one gets a
 * worker of its own that asks for the decoders it needs. Cleared on a failure, so a later document
 * tries again.
 * @type {Map<string, Promise<Uint8Array>>}
 */
const wasmCache = new Map();

/**
 * Fetch a bundled WebAssembly file, from the cache if it has already been fetched.
 * @param {string} fileName File name, e.g. `openjpeg.wasm`.
 * @returns {Promise<Uint8Array>} File content.
 * @throws {Error} When the file isn’t bundled, or can’t be fetched.
 */
const fetchWasm = async (fileName) => {
  if (!Object.hasOwn(WASM_URLS, fileName)) {
    throw new Error(`${fileName} isn’t bundled`);
  }

  let promise = wasmCache.get(fileName);

  if (!promise) {
    promise = fetch(WASM_URLS[fileName]).then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to fetch ${fileName}: ${response.status}`);
      }

      return new Uint8Array(await response.arrayBuffer());
    });

    promise.catch(() => {
      wasmCache.delete(fileName);
    });

    wasmCache.set(fileName, promise);
  }

  // PDF.js posts the bytes to the worker without transferring them, so the cache keeps its copy
  return promise;
};

/**
 * Data factory serving the files the PDF.js worker asks the main thread for. It’s only asked for
 * them as `getDocument()` is given no `wasmUrl` or other data URLs, which turns `useWorkerFetch`
 * off: the worker then requests each file by name, and the bundled URL is looked up here, rather
 * than resolved against a directory URL.
 * @see https://github.com/mozilla/pdf.js/blob/master/src/display/binary_data_factory.js
 */
export class BundledDataFactory {
  /**
   * Fetch a file for the worker.
   * @param {{ kind: string, filename: string }} args Arguments. `kind` is the option the file
   * would be fetched from, e.g. `wasmUrl` or `cMapUrl`.
   * @returns {Promise<Uint8Array>} File content.
   * @throws {Error} When the file isn’t bundled, or can’t be fetched.
   */
  async fetch({ kind, filename }) {
    if (kind !== 'wasmUrl') {
      throw new Error(`${filename} isn’t bundled`);
    }

    return fetchWasm(filename);
  }
}

/**
 * Get the options for loading a PDF document with the bundled PDF.js. The worker is started here,
 * as a module worker a consumer’s bundler picks up like any other, and handed to PDF.js through a
 * `PDFWorker`, which PDF.js doesn’t end when the loading task is destroyed; `dispose()` does.
 * @param {import('pdfjs-dist')} pdfjs PDF.js module.
 * @returns {{ options: Record<string, any>, dispose: () => void }} Options for `getDocument()`,
 * and a function to end the worker once the loading task has been destroyed.
 * @throws {Error} When PDF.js can’t take the worker, which is then ended.
 */
export const createLoadingOptions = (pdfjs) => {
  const port = new Worker(new URL('./pdf-worker.js', import.meta.url), { type: 'module' });
  /** @type {import('pdfjs-dist').PDFWorker} */
  let worker;

  try {
    // @ts-ignore The type definitions of PDF.js take only `null` for `port`
    worker = new pdfjs.PDFWorker({ port });
  } catch (ex) {
    port.terminate();
    throw ex;
  }

  return {
    options: { worker, BinaryDataFactory: BundledDataFactory },
    // eslint-disable-next-line jsdoc/require-jsdoc
    dispose: () => {
      worker.destroy();
      port.terminate();
    },
  };
};
