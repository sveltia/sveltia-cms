import { getUnpkgURL, loadModule } from '$lib/services/app/dependencies';
import { createModuleWorker } from '$lib/services/utils/media/image/heic-worker-factory';

/**
 * How long the worker is kept after its last job. Decoding a photo grows the WebAssembly heap to
 * several hundred megabytes, and the heap never shrinks, so the worker is terminated once a batch
 * — an upload, or the thumbnails of an asset list — is done, rather than kept for the session.
 * Long enough for the next asset in a list to reuse it without another fetch and compile.
 */
const IDLE_TIMEOUT = 10000;
/** @type {Promise<Worker> | undefined} */
let workerPromise;
/** @type {boolean} */
let workerUnavailable = false;
/** @type {ReturnType<typeof setTimeout> | undefined} */
let idleTimer;
/**
 * The pending decode jobs. Jobs are run one at a time: a decode blocks the worker anyway, and
 * running them serially means at most one photo’s pixels are held at once.
 * @type {Promise<any>}
 */
let queue = Promise.resolve();

/**
 * Get the source of the module worker. The decoder is imported from UNPKG inside the worker, which
 * has to be created from a same-origin URL, hence a Blob URL. The first message reports whether the
 * import succeeded; each later message is the decoded pixels of a job, or the error.
 * @returns {string} Script.
 */
const getWorkerScript = () => {
  const moduleURL = `${getUnpkgURL('@discourse/heic')}/index.js`;

  return `
    import(${JSON.stringify(moduleURL)}).then(
      ({ decode }) => {
        self.onmessage = async ({ data }) => {
          try {
            const { width, height, data: pixels } = await decode(data);

            postMessage({ width, height, data: pixels }, [pixels.buffer]);
          } catch (error) {
            postMessage({ error: String(error?.message ?? error) });
          }
        };

        postMessage({ ready: true });
      },
      (error) => postMessage({ error: String(error?.message ?? error) }),
    );
  `;
};

/**
 * Error thrown when a worker can’t be started at all, as opposed to the decoder failing to load in
 * it: only the former is worth falling back to the main thread for.
 */
class WorkerUnavailableError extends Error {}

/**
 * Create the worker and wait for the decoder to load in it.
 * @returns {Promise<Worker>} Worker.
 * @throws {WorkerUnavailableError} If the worker can’t be created or started, e.g. because a
 * Content Security Policy doesn’t allow `blob:` workers.
 * @throws {Error} If the decoder can’t be loaded in the worker.
 */
const createWorker = () =>
  new Promise((resolve, reject) => {
    const blob = new Blob([getWorkerScript()], { type: 'text/javascript' });
    const blobURL = URL.createObjectURL(blob);
    /** @type {Worker} */
    let worker;

    try {
      worker = createModuleWorker?.() ?? new Worker(blobURL, { type: 'module' });
    } catch (error) {
      // Chrome throws here when a Content Security Policy blocks the worker
      URL.revokeObjectURL(blobURL);
      reject(new WorkerUnavailableError('Failed to create a worker', { cause: error }));

      return;
    }

    /**
     * Handle the first message, which reports whether the decoder loaded.
     * @param {MessageEvent} event Event.
     */
    const onMessage = ({ data }) => {
      // eslint-disable-next-line no-use-before-define
      cleanup();

      if (data.ready) {
        resolve(worker);
      } else {
        worker.terminate();
        reject(new Error(data.error));
      }
    };

    /**
     * Handle the worker failing to start, e.g. Firefox reporting a Content Security Policy
     * violation, which it does here rather than by throwing.
     * @param {ErrorEvent} event Event.
     */
    const onError = (event) => {
      // eslint-disable-next-line no-use-before-define
      cleanup();
      worker.terminate();
      reject(new WorkerUnavailableError(event.message));
    };

    /**
     * Remove the listeners, so they don’t act on later messages and errors, and release the URL,
     * as the script has been fetched by now.
     */
    const cleanup = () => {
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
      URL.revokeObjectURL(blobURL);
    };

    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', onError);
  });

/**
 * Get the worker, creating it if needed. A creation failure isn’t cached, so it can be retried.
 * @returns {Promise<Worker>} Worker.
 * @throws {Error} If the worker can’t be created.
 */
const getWorker = () => {
  clearTimeout(idleTimer);

  workerPromise ??= createWorker().catch((error) => {
    workerPromise = undefined;

    throw error;
  });

  return workerPromise;
};

/**
 * Terminate the worker, releasing the decoder’s memory.
 */
const terminateWorker = async () => {
  const worker = await workerPromise;

  workerPromise = undefined;
  worker?.terminate();
};

/**
 * Decode a HEIC image in the worker.
 * @param {Worker} worker Worker.
 * @param {ArrayBuffer} buffer File content. Transferred to the worker.
 * @returns {Promise<ImageData>} Decoded pixels.
 * @throws {Error} If the image can’t be decoded.
 */
const decodeInWorker = (worker, buffer) =>
  new Promise((resolve, reject) => {
    /**
     * Handle a message from the worker. Jobs run one at a time, so the next message is the result
     * of this one.
     * @param {MessageEvent} event Event.
     */
    const onMessage = ({ data }) => {
      // eslint-disable-next-line no-use-before-define
      cleanup();
      idleTimer = setTimeout(terminateWorker, IDLE_TIMEOUT);

      if (data.error) {
        reject(new Error(data.error));

        return;
      }

      try {
        resolve(new ImageData(data.data, data.width, data.height));
      } catch (error) {
        // Pixels that don’t match the dimensions; an exception here would otherwise be swallowed
        // by the event listener and leave the job pending forever
        reject(error);
      }
    };

    /**
     * Handle an uncaught error in the worker. Its state is unknown, so it’s replaced: a message
     * posted to a dead worker would never be answered, and the queue would never move on.
     * @param {ErrorEvent} event Event.
     */
    const onError = (event) => {
      // eslint-disable-next-line no-use-before-define
      cleanup();
      workerPromise = undefined;
      worker.terminate();
      reject(new Error(event.message));
    };

    /**
     * Remove the listeners.
     */
    const cleanup = () => {
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
    };

    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', onError);
    worker.postMessage(buffer, [buffer]);
  });

/**
 * Decode a HEIC image on the main thread. Only used when a worker can’t be created; a decode takes
 * half a second for a 12-megapixel photo, during which the UI is frozen.
 * @param {ArrayBuffer} buffer File content.
 * @returns {Promise<ImageData>} Decoded pixels.
 * @throws {Error} If the decoder can’t be loaded or the image can’t be decoded.
 */
const decodeOnMainThread = async (buffer) => {
  /** @type {{ decode: (buffer: ArrayBuffer) => Promise<ImageData> }} */
  const { decode } = await loadModule('@discourse/heic', 'index.js');

  return decode(buffer);
};

/**
 * Decode a HEIC image, in the worker if one can be started, on the main thread otherwise.
 * @param {ArrayBuffer} buffer File content.
 * @returns {Promise<ImageData>} Decoded pixels.
 * @throws {Error} If the image can’t be decoded, or the decoder can’t be loaded.
 */
const decodeBuffer = async (buffer) => {
  if (!workerUnavailable) {
    /** @type {Worker | undefined} */
    let worker;

    try {
      worker = await getWorker();
    } catch (error) {
      if (!(error instanceof WorkerUnavailableError)) {
        // The decoder couldn’t be loaded in the worker, e.g. UNPKG is blocked; it wouldn’t load on
        // the main thread either, and a transient failure is worth retrying in the worker
        throw error;
      }

      // A Content Security Policy that doesn’t allow `blob:` workers, most likely; the decoder can
      // still be loaded directly if the policy allows UNPKG, as it must for the other libraries
      workerUnavailable = true;
    }

    if (worker) {
      return decodeInWorker(worker, buffer);
    }
  }

  return decodeOnMainThread(buffer);
};

/**
 * Decode a HEIC (HEIF) image, which browsers other than Safari can’t decode natively, using the
 * `@discourse/heic` WebAssembly build of libheif. The decoder runs in a worker, one image at a
 * time, so a batch of photos doesn’t freeze the UI or hold every photo’s pixels in memory at once.
 * @param {Blob} blob File or blob.
 * @returns {Promise<ImageData>} Decoded pixels, which `createImageBitmap()` accepts as a source.
 * @throws {Error} If the image can’t be decoded.
 * @see https://github.com/discourse/jSquash
 * @see https://github.com/jamsinclair/jSquash/pull/101
 */
export const decodeHEIC = (blob) => {
  // Read the file within the queue, so only one photo is held in memory at a time
  const job = queue.then(async () => decodeBuffer(await blob.arrayBuffer()));

  queue = job.catch(() => undefined);

  return job;
};
