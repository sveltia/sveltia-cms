/* eslint-disable max-classes-per-file, jsdoc/require-jsdoc */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('$lib/services/app/dependencies', () => ({
  getUnpkgURL: vi.fn(() => 'https://unpkg.com/@discourse/heic@1.0.0'),
  loadModule: vi.fn(),
}));

/**
 * Mock `Worker` that records what’s posted to it and lets a test reply.
 */
class MockWorker extends EventTarget {
  /** @type {MockWorker[]} */
  static instances = [];

  /** @type {((worker: MockWorker) => void) | undefined} */
  static onCreate;

  /** @type {((worker: MockWorker, data: any) => void) | undefined} */
  static onPost;

  /** @type {{ data: any, transfer: any[] | undefined }[]} */
  posted = [];

  terminate = vi.fn();

  /**
   * Create a worker.
   * @param {string} url Script URL.
   * @param {WorkerOptions} options Options.
   */
  constructor(url, options) {
    super();
    this.url = url;
    this.options = options;
    MockWorker.instances.push(this);
    MockWorker.onCreate?.(this);
  }

  /**
   * Record a posted message.
   * @param {any} data Data.
   * @param {any[]} [transfer] Transferable objects.
   */
  postMessage(data, transfer) {
    this.posted.push({ data, transfer });
    MockWorker.onPost?.(this, data);
  }

  /**
   * Reply with a message.
   * @param {any} data Data.
   */
  reply(data) {
    this.dispatchEvent(new MessageEvent('message', { data }));
  }

  /**
   * Fire an uncaught error.
   * @param {string} message Message.
   */
  fail(message) {
    this.dispatchEvent(Object.assign(new Event('error'), { message }));
  }
}

/**
 * Mock `ImageData`.
 */
class MockImageData {
  /**
   * Create image data.
   * @param {Uint8ClampedArray} data Pixels.
   * @param {number} width Width.
   * @param {number} height Height.
   */
  constructor(data, width, height) {
    this.data = data;
    this.width = width;
    this.height = height;
  }
}

/**
 * Make every worker report that the decoder loaded, and reply to every job with a 2×1 image.
 */
const autoReply = () => {
  MockWorker.onCreate = (worker) => queueMicrotask(() => worker.reply({ ready: true }));
  MockWorker.onPost = (worker) =>
    queueMicrotask(() => worker.reply({ width: 2, height: 1, data: new Uint8ClampedArray(8) }));
};

/**
 * Let the pending microtasks run.
 * @returns {Promise<void>} Promise resolved on the next macrotask.
 */
const flush = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

/**
 * Import a fresh copy of the module, as it keeps the worker and the queue in module state.
 * @returns {Promise<typeof import('./heic')>} Module.
 */
const importModule = async () => {
  vi.resetModules();

  return import('./heic');
};

describe('decodeHEIC', () => {
  const heicBlob = new Blob([new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70])]);
  /** @type {any} */
  let createObjectURL;
  /** @type {any} */
  let revokeObjectURL;

  beforeEach(() => {
    MockWorker.instances = [];
    MockWorker.onCreate = undefined;
    MockWorker.onPost = undefined;
    // @ts-ignore
    globalThis.Worker = MockWorker;
    // @ts-ignore
    globalThis.ImageData = MockImageData;
    createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:worker');
    revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  test('should decode in a module worker created from a blob URL', async () => {
    autoReply();

    const { decodeHEIC } = await importModule();
    const imageData = await decodeHEIC(heicBlob);

    expect(imageData).toBeInstanceOf(MockImageData);
    expect(imageData).toEqual({ width: 2, height: 1, data: new Uint8ClampedArray(8) });

    expect(MockWorker.instances).toHaveLength(1);

    const [worker] = MockWorker.instances;

    expect(worker.url).toBe('blob:worker');
    expect(worker.options).toEqual({ type: 'module' });

    // The script imports the decoder from UNPKG
    const script = await createObjectURL.mock.calls[0][0].text();

    expect(script).toContain('import("https://unpkg.com/@discourse/heic@1.0.0/index.js")');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:worker');

    // The file content is transferred rather than copied
    expect(worker.posted).toHaveLength(1);

    const { data, transfer } = worker.posted[0];

    expect(data).toBeInstanceOf(ArrayBuffer);
    expect(data.byteLength).toBe(8);
    expect(transfer).toEqual([data]);
  });

  test('should decode one image at a time and reuse the worker', async () => {
    MockWorker.onCreate = (worker) => queueMicrotask(() => worker.reply({ ready: true }));

    const { decodeHEIC } = await importModule();
    const promise1 = decodeHEIC(heicBlob);
    const promise2 = decodeHEIC(heicBlob);

    await flush();

    const [worker] = MockWorker.instances;

    // The second job waits for the first
    expect(worker.posted).toHaveLength(1);

    worker.reply({ width: 1, height: 1, data: new Uint8ClampedArray(4) });
    await expect(promise1).resolves.toEqual({
      width: 1,
      height: 1,
      data: new Uint8ClampedArray(4),
    });
    await flush();
    expect(worker.posted).toHaveLength(2);

    worker.reply({ width: 2, height: 2, data: new Uint8ClampedArray(16) });
    await expect(promise2).resolves.toEqual({
      width: 2,
      height: 2,
      data: new Uint8ClampedArray(16),
    });

    expect(MockWorker.instances).toHaveLength(1);
    expect(worker.terminate).not.toHaveBeenCalled();
  });

  test('should terminate the worker once idle, and create another for the next image', async () => {
    vi.useFakeTimers();
    autoReply();

    const { decodeHEIC } = await importModule();

    await decodeHEIC(heicBlob);

    const [worker] = MockWorker.instances;

    // Still around shortly after
    await vi.advanceTimersByTimeAsync(9000);
    expect(worker.terminate).not.toHaveBeenCalled();

    // A new job resets the timer
    await decodeHEIC(heicBlob);
    await vi.advanceTimersByTimeAsync(9000);
    expect(worker.terminate).not.toHaveBeenCalled();
    expect(MockWorker.instances).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(worker.terminate).toHaveBeenCalledOnce();

    await decodeHEIC(heicBlob);
    expect(MockWorker.instances).toHaveLength(2);
  });

  test('should reject when the worker reports a decoding error, and keep the worker', async () => {
    MockWorker.onCreate = (worker) => queueMicrotask(() => worker.reply({ ready: true }));

    const { decodeHEIC } = await importModule();
    const promise1 = decodeHEIC(heicBlob);

    await flush();

    const [worker] = MockWorker.instances;

    worker.reply({ error: 'Decoding error' });
    await expect(promise1).rejects.toThrow('Decoding error');

    // The queue carries on, in the same worker
    const promise2 = decodeHEIC(heicBlob);

    await flush();
    expect(MockWorker.instances).toHaveLength(1);
    expect(worker.posted).toHaveLength(2);
    worker.reply({ width: 1, height: 1, data: new Uint8ClampedArray(4) });
    await expect(promise2).resolves.toBeInstanceOf(MockImageData);

    const { loadModule } = await import('$lib/services/app/dependencies');

    expect(loadModule).not.toHaveBeenCalled();
  });

  test('should reject when the pixels don’t match the dimensions', async () => {
    MockWorker.onCreate = (worker) => queueMicrotask(() => worker.reply({ ready: true }));

    const { decodeHEIC } = await importModule();
    const promise = decodeHEIC(heicBlob);

    await flush();

    const [worker] = MockWorker.instances;

    // What the `ImageData` constructor does with a buffer of the wrong length
    // @ts-ignore
    globalThis.ImageData = class {
      /**
       * Throw like the real constructor.
       * @throws {DOMException} Always.
       */
      constructor() {
        throw new DOMException('Invalid data length', 'InvalidStateError');
      }
    };

    worker.reply({ width: 2, height: 2, data: new Uint8ClampedArray(4) });
    // Rejected rather than left pending, which would stall the queue
    await expect(promise).rejects.toThrow('Invalid data length');

    // The worker itself is fine, so the next job reuses it
    // @ts-ignore
    globalThis.ImageData = MockImageData;
    MockWorker.onPost = (w) =>
      queueMicrotask(() => w.reply({ width: 1, height: 1, data: new Uint8ClampedArray(4) }));
    await expect(decodeHEIC(heicBlob)).resolves.toBeInstanceOf(MockImageData);
    expect(MockWorker.instances).toHaveLength(1);
  });

  test('should reject when the worker throws while decoding, and replace the worker', async () => {
    MockWorker.onCreate = (worker) => queueMicrotask(() => worker.reply({ ready: true }));

    const { decodeHEIC } = await importModule();
    const promise = decodeHEIC(heicBlob);

    await flush();

    const [worker] = MockWorker.instances;

    worker.fail('Out of memory');
    await expect(promise).rejects.toThrow('Out of memory');
    // The worker is in an unknown state, so it’s not reused: a message posted to a dead worker
    // would never be answered
    expect(worker.terminate).toHaveBeenCalledOnce();

    MockWorker.onPost = (w) =>
      queueMicrotask(() => w.reply({ width: 1, height: 1, data: new Uint8ClampedArray(4) }));
    await expect(decodeHEIC(heicBlob)).resolves.toBeInstanceOf(MockImageData);
    expect(MockWorker.instances).toHaveLength(2);

    const { loadModule } = await import('$lib/services/app/dependencies');

    expect(loadModule).not.toHaveBeenCalled();
  });

  test('should reject when the decoder can’t load in the worker, and try again later', async () => {
    MockWorker.onCreate = (worker) =>
      queueMicrotask(() => worker.reply({ error: 'Failed to fetch' }));

    const { decodeHEIC } = await importModule();

    // A transient network failure; loading on the main thread wouldn’t do any better
    await expect(decodeHEIC(heicBlob)).rejects.toThrow('Failed to fetch');
    expect(MockWorker.instances[0].terminate).toHaveBeenCalledOnce();

    const { loadModule } = await import('$lib/services/app/dependencies');

    expect(loadModule).not.toHaveBeenCalled();

    // The next job creates a worker again rather than decoding on the main thread
    autoReply();
    await expect(decodeHEIC(heicBlob)).resolves.toBeInstanceOf(MockImageData);
    expect(MockWorker.instances).toHaveLength(2);
    expect(loadModule).not.toHaveBeenCalled();
  });

  describe('fallback', () => {
    /** @type {any} */
    let decode;

    beforeEach(async () => {
      decode = vi.fn().mockResolvedValue(new MockImageData(new Uint8ClampedArray(4), 1, 1));

      const { loadModule } = await import('$lib/services/app/dependencies');

      vi.mocked(loadModule).mockResolvedValue({ decode });
    });

    test('should decode on the main thread if the worker can’t be created', async () => {
      // A Content Security Policy that doesn’t allow `blob:` workers
      globalThis.Worker = vi.fn(() => {
        throw new Error('Refused to create a worker');
      });

      const { decodeHEIC } = await importModule();

      await expect(decodeHEIC(heicBlob)).resolves.toBeInstanceOf(MockImageData);

      const { loadModule } = await import('$lib/services/app/dependencies');

      expect(loadModule).toHaveBeenCalledWith('@discourse/heic', 'index.js');
      expect(decode).toHaveBeenCalledWith(expect.any(ArrayBuffer));
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:worker');

      // Not tried again
      await expect(decodeHEIC(heicBlob)).resolves.toBeInstanceOf(MockImageData);
      expect(globalThis.Worker).toHaveBeenCalledOnce();
      expect(decode).toHaveBeenCalledTimes(2);
    });

    test('should decode on the main thread if the worker fails to start', async () => {
      // Firefox reports a Content Security Policy violation this way rather than by throwing
      MockWorker.onCreate = (worker) => queueMicrotask(() => worker.fail('Script error'));

      const { decodeHEIC } = await importModule();

      await expect(decodeHEIC(heicBlob)).resolves.toBeInstanceOf(MockImageData);
      expect(MockWorker.instances[0].terminate).toHaveBeenCalledOnce();
      expect(decode).toHaveBeenCalledOnce();

      // Not tried again
      await expect(decodeHEIC(heicBlob)).resolves.toBeInstanceOf(MockImageData);
      expect(MockWorker.instances).toHaveLength(1);
      expect(decode).toHaveBeenCalledTimes(2);
    });

    test('should reject if the main thread decoder fails as well', async () => {
      globalThis.Worker = vi.fn(() => {
        throw new Error('Refused to create a worker');
      });
      decode.mockRejectedValue(new Error('Decoding error'));

      const { decodeHEIC } = await importModule();

      await expect(decodeHEIC(heicBlob)).rejects.toThrow('Decoding error');
      // The next job isn’t stuck behind the failed one
      decode.mockResolvedValue(new MockImageData(new Uint8ClampedArray(4), 1, 1));
      await expect(decodeHEIC(heicBlob)).resolves.toBeInstanceOf(MockImageData);
    });
  });
});
