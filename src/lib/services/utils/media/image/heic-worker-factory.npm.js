import wasmURL from '@discourse/heic/codec/dec/heic_dec.wasm?url';

/**
 * Compiled HEIC decoder, shared by every worker: `heic.js` ends an idle worker and starts another
 * for the next job, and a compiled module can be sent to any number of workers, so the file is
 * only fetched and compiled once. Cleared on a failure, so a later worker tries again.
 * @type {Promise<WebAssembly.Module> | undefined}
 */
let decoderModule;

/**
 * Get the compiled HEIC decoder, fetching and compiling it on first use.
 * @returns {Promise<WebAssembly.Module>} Module.
 */
const getDecoderModule = () => {
  decoderModule ??= fetch(wasmURL)
    .then((response) => response.arrayBuffer())
    .then((buffer) => WebAssembly.compile(buffer))
    .catch((error) => {
      decoderModule = undefined;
      throw error;
    });

  return decoderModule;
};

/**
 * Create a module worker running the bundled HEIC decoder. The WebAssembly module is compiled here
 * and handed over to the worker, rather than fetched by the decoder from a URL relative to the
 * worker: a consumer’s bundler copies a prebuilt worker as is, so the relative URL would miss the
 * renamed `.wasm` file, while the URL in this module is rewritten like any other asset reference.
 * @returns {Worker} Worker.
 */
export const createModuleWorker = () => {
  const worker = new Worker(new URL('./heic-worker.js', import.meta.url), { type: 'module' });

  getDecoderModule().then(
    (module) => worker.postMessage({ module }),
    (error) => worker.postMessage({ error: String(error?.message ?? error) }),
  );

  return worker;
};
