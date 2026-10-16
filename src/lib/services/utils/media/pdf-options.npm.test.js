/* eslint-disable jsdoc/require-jsdoc, max-classes-per-file */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Import a fresh copy of the module, which keeps the fetched WebAssembly files in module state.
 * @returns {Promise<typeof import('./pdf-options.npm')>} Module.
 */
const importOptions = async () => {
  vi.resetModules();

  return import('./pdf-options.npm');
};

/**
 * Create a `fetch()` response with the given bytes.
 * @param {number[]} bytes Bytes.
 * @param {number} [status] HTTP status.
 * @returns {any} Response.
 */
const createResponse = (bytes, status = 200) => ({
  ok: status === 200,
  status,
  arrayBuffer: async () => new Uint8Array(bytes).buffer,
});

describe('BundledDataFactory', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => createResponse([0, 97, 115, 109])),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each(['openjpeg.wasm', 'jbig2.wasm'])('serves the bundled %s', async (filename) => {
    const { BundledDataFactory } = await importOptions();

    await expect(new BundledDataFactory().fetch({ kind: 'wasmUrl', filename })).resolves.toEqual(
      new Uint8Array([0, 97, 115, 109]),
    );
    // The URL of the WebAssembly file is resolved like any other asset
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining(filename.replace('.wasm', '')));
  });

  it('fetches a file once', async () => {
    const { BundledDataFactory } = await importOptions();
    const factory = new BundledDataFactory();

    await factory.fetch({ kind: 'wasmUrl', filename: 'openjpeg.wasm' });
    await expect(factory.fetch({ kind: 'wasmUrl', filename: 'openjpeg.wasm' })).resolves.toEqual(
      new Uint8Array([0, 97, 115, 109]),
    );
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('fetches a file again after a failure', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(createResponse([], 404))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const { BundledDataFactory } = await importOptions();
    const factory = new BundledDataFactory();
    const args = { kind: 'wasmUrl', filename: 'jbig2.wasm' };

    await expect(factory.fetch(args)).rejects.toThrow('Failed to fetch jbig2.wasm: 404');
    await expect(factory.fetch(args)).rejects.toThrow('Failed to fetch');
    await expect(factory.fetch(args)).resolves.toEqual(new Uint8Array([0, 97, 115, 109]));
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it.each([
    ['a WebAssembly file that isn’t bundled', 'wasmUrl', 'qcms_bg.wasm'],
    ['a name inherited from `Object`', 'wasmUrl', 'toString'],
    ['a character map', 'cMapUrl', 'UniJIS-UCS2-H.bcmap'],
    ['a standard font', 'standardFontDataUrl', 'FoxitSymbol.pfb'],
  ])('rejects %s', async (_, kind, filename) => {
    const { BundledDataFactory } = await importOptions();

    await expect(new BundledDataFactory().fetch({ kind, filename })).rejects.toThrow(
      `${filename} isn’t bundled`,
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('createLoadingOptions', () => {
  /**
   * Mock `Worker` that records its URL and options.
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
      this.terminate = vi.fn();
    }
  }

  /**
   * Mock `PDFWorker` that records the port it’s given.
   */
  class MockPDFWorker {
    /**
     * Create a PDF.js worker.
     * @param {{ port: MockWorker }} params Parameters.
     */
    constructor({ port }) {
      this.port = port;
      this.destroy = vi.fn();
    }
  }

  beforeEach(() => {
    vi.stubGlobal('Worker', MockWorker);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts a module worker, and ends it on disposal', async () => {
    const { createLoadingOptions, BundledDataFactory } = await importOptions();

    const { options, dispose } = createLoadingOptions(
      /** @type {any} */ ({ PDFWorker: MockPDFWorker }),
    );

    const { worker } = options;

    expect(worker).toBeInstanceOf(MockPDFWorker);
    expect(String(worker.port.url)).toMatch(/\/pdf-worker\.js$/);
    expect(worker.port.options).toEqual({ type: 'module' });
    expect(options.BinaryDataFactory).toBe(BundledDataFactory);
    // No data URLs, so the worker asks the factory for the files
    expect(Object.keys(options)).toEqual(['worker', 'BinaryDataFactory']);

    dispose();

    expect(worker.destroy).toHaveBeenCalledOnce();
    expect(worker.port.terminate).toHaveBeenCalledOnce();
  });

  it('ends the worker when PDF.js can’t take it', async () => {
    const { createLoadingOptions } = await importOptions();
    /** @type {MockWorker | undefined} */
    let port;

    expect(() =>
      createLoadingOptions(
        /** @type {any} */ ({
          PDFWorker: class {
            constructor(/** @type {{ port: MockWorker }} */ params) {
              ({ port } = params);
              throw new Error('Cannot use more than one PDFWorker per port.');
            }
          },
        }),
      ),
    ).toThrow('Cannot use more than one PDFWorker per port.');
    expect(port?.terminate).toHaveBeenCalledOnce();
  });
});
