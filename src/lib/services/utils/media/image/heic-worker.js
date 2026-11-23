/**
 * Module worker decoding HEIC images in the npm build, where the decoder is bundled rather than
 * imported from UNPKG. Speaks the same protocol as the Blob URL worker in `heic.js`, except that
 * the first message it receives is the compiled WebAssembly module or the error compiling it, see
 * `heic-worker-factory.npm.js`. The decoder is imported statically, so the worker is a
 * self-contained file: a consumer’s bundler would inline a tiny one as a `data:` URL, from which a
 * relative `import()` can’t be resolved.
 */
import { decode } from '@discourse/heic';
import { init } from '@discourse/heic/decode.js';

/**
 * Global scope of the worker, typed for what is used here, as the project doesn’t load the
 * WebWorker type definitions.
 * @type {{
 * onmessage: ((event: MessageEvent) => void) | null,
 * postMessage: (message: any, transfer?: Transferable[]) => void,
 * }}
 */
const scope = /** @type {any} */ (globalThis);

/**
 * Decode an image, and send the pixels or the error back.
 * @param {MessageEvent<ArrayBuffer>} event Message with the image data.
 */
export const onDecodeMessage = async ({ data }) => {
  try {
    const { width, height, data: pixels } = await decode(data);

    scope.postMessage({ width, height, data: pixels }, [pixels.buffer]);
  } catch (ex) {
    scope.postMessage({ error: String(/** @type {Error} */ (ex)?.message ?? ex) });
  }
};

/**
 * Initialize the decoder with the compiled WebAssembly module, then start handling decode jobs.
 * @param {MessageEvent<{ module?: WebAssembly.Module, error?: string }>} event Message with the
 * module, or the error compiling it.
 */
export const onInitMessage = ({ data: { module, error } }) => {
  if (error) {
    scope.postMessage({ error });

    return;
  }

  init(module);
  scope.onmessage = onDecodeMessage;
  scope.postMessage({ ready: true });
};

scope.onmessage = onInitMessage;
