import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { decode, init } = vi.hoisted(() => ({ decode: vi.fn(), init: vi.fn() }));

vi.mock('@discourse/heic', () => ({ decode }));
vi.mock('@discourse/heic/decode.js', () => ({ init }));

describe('HEIC worker', () => {
  /** @type {import('vitest').Mock} */
  let postMessage;

  beforeEach(() => {
    postMessage = vi.fn();
    vi.stubGlobal('postMessage', postMessage);
    vi.stubGlobal('onmessage', null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /**
   * Import a fresh copy of the worker script, which sets up the message handler when it runs.
   * @returns {Promise<typeof import('./heic-worker')>} Module.
   */
  const importWorker = async () => {
    vi.resetModules();

    return import('./heic-worker');
  };

  it('initializes the decoder with the module, then decodes images', async () => {
    const { onDecodeMessage, onInitMessage } = await importWorker();
    const module = {};
    const pixels = new Uint8ClampedArray(8);

    expect(globalThis.onmessage).toBe(onInitMessage);

    onInitMessage(/** @type {any} */ ({ data: { module } }));

    expect(init).toHaveBeenCalledWith(module);
    expect(postMessage).toHaveBeenCalledWith({ ready: true });
    expect(globalThis.onmessage).toBe(onDecodeMessage);

    decode.mockResolvedValue({ width: 2, height: 1, data: pixels });

    const buffer = new ArrayBuffer(8);

    await onDecodeMessage(/** @type {any} */ ({ data: buffer }));

    expect(decode).toHaveBeenCalledWith(buffer);
    // The pixels are transferred rather than copied
    expect(postMessage).toHaveBeenLastCalledWith({ width: 2, height: 1, data: pixels }, [
      pixels.buffer,
    ]);
  });

  it('reports the error compiling the module', async () => {
    const { onInitMessage } = await importWorker();

    onInitMessage(/** @type {any} */ ({ data: { error: 'CompileError' } }));

    expect(init).not.toHaveBeenCalled();
    expect(postMessage).toHaveBeenCalledWith({ error: 'CompileError' });
  });

  it.each([
    ['an error', new Error('Decoding error'), 'Decoding error'],
    ['a value that isn’t an error', 'Unknown', 'Unknown'],
  ])('reports %s thrown while decoding', async (_, thrown, message) => {
    const { onDecodeMessage } = await importWorker();

    decode.mockRejectedValue(thrown);
    await onDecodeMessage(/** @type {any} */ ({ data: new ArrayBuffer(8) }));

    expect(postMessage).toHaveBeenCalledWith({ error: message });
  });
});
