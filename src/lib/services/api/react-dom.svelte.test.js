// @vitest-environment happy-dom

import { beforeEach, describe, expect, test, vi } from 'vitest';

import { _resetImmutable } from '$lib/services/api/immutable';
import { _resetReactDom } from '$lib/services/api/react-dom';
import { loadChunk, loadModule } from '$lib/services/app/dependencies';
import { createRawState, createRootEffect } from '$lib/services/utils/state.svelte';

import { createReactRenderer } from './react-dom.svelte.js';

vi.mock('$lib/services/app/dependencies', () => ({
  getUnpkgURL: vi.fn(() => ''),
  loadChunk: vi.fn(),
  loadModule: vi.fn(),
}));

/**
 * Wait for the effects and the libraries to load.
 * @returns {Promise<void>} Promise that resolves after a short delay.
 */
const wait = () =>
  new Promise((resolve) => {
    setTimeout(resolve);
  });

describe('createReactRenderer()', () => {
  const root = { render: vi.fn(), unmount: vi.fn() };
  const createRoot = vi.fn(() => root);

  beforeEach(() => {
    _resetImmutable();
    _resetReactDom();
    vi.mocked(loadModule).mockResolvedValue({});
    vi.mocked(loadChunk).mockResolvedValue({ createRoot });
  });

  test('is ready once the libraries are loaded and the container is there', async () => {
    const container = createRawState(/** @type {HTMLElement | undefined} */ (undefined));
    /** @type {ReturnType<typeof createReactRenderer> | undefined} */
    let renderer;
    /** @type {boolean[]} */
    const states = [];

    const stop = createRootEffect(() => {
      renderer = createReactRenderer(() => container.current);
    });

    // The readiness is reactive
    const stopWatching = createRootEffect(() => {
      states.push(!!renderer?.ready);
    });

    await wait();
    expect(loadModule).toHaveBeenCalledOnce();
    expect(loadChunk).toHaveBeenCalledWith('react-dom');
    expect(renderer?.ready).toBe(false);

    const element = document.createElement('div');

    container.current = element;
    await wait();
    expect(renderer?.ready).toBe(true);
    expect(states[0]).toBe(false);
    expect(states.at(-1)).toBe(true);

    // The root is created on the first render only
    renderer?.render('a');
    renderer?.render('b');
    expect(createRoot).toHaveBeenCalledOnce();
    expect(createRoot).toHaveBeenCalledWith(element);
    expect(root.render.mock.calls).toEqual([['a'], ['b']]);

    stopWatching();
    stop();
    expect(root.unmount).toHaveBeenCalledOnce();
  });

  test('has nothing to unmount without a render', async () => {
    const stop = createRootEffect(() => {
      createReactRenderer(() => document.createElement('div'));
    });

    await wait();
    stop();
    expect(root.unmount).not.toHaveBeenCalled();
  });

  test('logs a failure to load the libraries', async () => {
    const error = new Error('offline');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    vi.mocked(loadChunk).mockRejectedValue(error);

    const stop = createRootEffect(() => {
      createReactRenderer(() => undefined);
    });

    await wait();
    expect(consoleError).toHaveBeenCalledWith(error);
    stop();
    consoleError.mockRestore();
  });
});
