/**
 * Create a module worker running the bundled HEIC decoder. `undefined` in the CDN builds, which
 * create a Blob URL worker importing the decoder from UNPKG instead; the npm build replaces this
 * module with `heic-worker-factory.npm.js`.
 * @type {(() => Worker) | undefined}
 */
export const createModuleWorker = undefined;
