/* eslint-disable jsdoc/require-jsdoc */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Import a fresh copy of the module, which keeps the compiled decoder in module state.
 * @returns {Promise<typeof import('./heic-worker-factory.npm')>} Module.
 */
const importFactory = async () => {
  vi.resetModules();

  return import('./heic-worker-factory.npm');
};

/**
 * Mock `Worker` that records its URL and the posted messages.
 */
class MockWorker {
  /**
   * Create a worker.
   * @param {URL} url Script URL.
   * @param {WorkerOptions} options Options.
   */
  constructor(url, options) {
    this.url = url;
    this.options = options;
    this.postMessage = vi.fn();
  }
}

describe('createModuleWorker', () => {
  const module = {};

  beforeEach(() => {
    vi.stubGlobal('Worker', MockWorker);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(8) })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('starts the worker and hands it the compiled decoder', async () => {
    vi.spyOn(WebAssembly, 'compile').mockResolvedValue(/** @type {any} */ (module));

    const { createModuleWorker } = await importFactory();
    const worker = /** @type {any} */ (createModuleWorker());

    expect(String(worker.url)).toMatch(/\/heic-worker\.js$/);
    expect(worker.options).toEqual({ type: 'module' });
    // The URL of the WebAssembly file is resolved like any other asset
    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/heic_dec\.wasm/));
    await vi.waitFor(() => expect(worker.postMessage).toHaveBeenCalledWith({ module }));
  });

  it.each([
    ['an error', new Error('CompileError: invalid'), 'CompileError: invalid'],
    ['a value that isn’t an error', 'Unknown', 'Unknown'],
  ])('passes on %s compiling the decoder', async (_, thrown, message) => {
    vi.spyOn(WebAssembly, 'compile').mockRejectedValue(thrown);

    const { createModuleWorker } = await importFactory();
    const worker = /** @type {any} */ (createModuleWorker());

    await vi.waitFor(() => expect(worker.postMessage).toHaveBeenCalledWith({ error: message }));
  });

  it('compiles the decoder once for every worker', async () => {
    const compile = vi.spyOn(WebAssembly, 'compile').mockResolvedValue(/** @type {any} */ (module));
    const { createModuleWorker } = await importFactory();
    const first = /** @type {any} */ (createModuleWorker());
    const second = /** @type {any} */ (createModuleWorker());

    await vi.waitFor(() => expect(second.postMessage).toHaveBeenCalledWith({ module }));
    expect(first.postMessage).toHaveBeenCalledWith({ module });
    expect(fetch).toHaveBeenCalledOnce();
    expect(compile).toHaveBeenCalledOnce();
  });

  it('tries again with the next worker after a failure', async () => {
    const compile = vi
      .spyOn(WebAssembly, 'compile')
      .mockRejectedValueOnce(new Error('NetworkError'))
      .mockResolvedValue(/** @type {any} */ (module));

    const { createModuleWorker } = await importFactory();
    const first = /** @type {any} */ (createModuleWorker());

    await vi.waitFor(() =>
      expect(first.postMessage).toHaveBeenCalledWith({ error: 'NetworkError' }),
    );

    const second = /** @type {any} */ (createModuleWorker());

    await vi.waitFor(() => expect(second.postMessage).toHaveBeenCalledWith({ module }));
    expect(compile).toHaveBeenCalledTimes(2);
  });
});
