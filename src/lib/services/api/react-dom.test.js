// @vitest-environment happy-dom

import { beforeEach, describe, expect, test, vi } from 'vitest';

import { loadChunk } from '$lib/services/app/dependencies';

import {
  _resetReactDom,
  createReactRoot,
  getReactDom,
  loadReactDom,
  mountReactNode,
  preloadReactDom,
  reactDomLoaded,
} from './react-dom';

vi.mock('$lib/services/app/dependencies', () => ({
  loadChunk: vi.fn(),
}));

describe('react-dom loader', () => {
  const module = { createRoot: vi.fn() };

  beforeEach(() => {
    _resetReactDom();
    vi.mocked(loadChunk).mockResolvedValue(module);
  });

  test('loads the chunk once', async () => {
    expect(reactDomLoaded.current).toBe(false);

    const [first, second] = await Promise.all([loadReactDom(), loadReactDom()]);

    expect(first).toBe(module);
    expect(second).toBe(module);
    expect(loadChunk).toHaveBeenCalledOnce();
    expect(loadChunk).toHaveBeenCalledWith('react-dom');
    expect(reactDomLoaded.current).toBe(true);

    await loadReactDom();
    expect(loadChunk).toHaveBeenCalledOnce();
  });

  test('preloads without surfacing a failure, and tries again later', async () => {
    vi.mocked(loadChunk).mockRejectedValue(new Error('offline'));

    expect(() => preloadReactDom()).not.toThrow();
    await Promise.resolve();
    await expect(loadReactDom()).rejects.toThrow('offline');
    expect(reactDomLoaded.current).toBe(false);

    // A failed load isn’t cached, so the next call tries again
    vi.mocked(loadChunk).mockResolvedValue(module);
    expect(await loadReactDom()).toBe(module);
    expect(reactDomLoaded.current).toBe(true);
  });

  test('throws when the module is read before it’s loaded', async () => {
    expect(() => getReactDom()).toThrow('react-dom is not loaded yet');

    await loadReactDom();
    expect(getReactDom()).toBe(module);
  });
});

describe('React roots', () => {
  const root = { render: vi.fn(), unmount: vi.fn() };
  const module = { createRoot: vi.fn(() => root) };

  beforeEach(() => {
    _resetReactDom();
    vi.mocked(loadChunk).mockResolvedValue(module);
  });

  test('createReactRoot() creates the root on the first render only', async () => {
    await loadReactDom();

    const element = document.createElement('div');
    const handle = createReactRoot(element);

    // Nothing to unmount before the first render
    handle.unmount();

    expect(root.unmount).not.toHaveBeenCalled();

    handle.render('a');
    handle.render('b');

    expect(module.createRoot).toHaveBeenCalledTimes(1);
    expect(module.createRoot).toHaveBeenCalledWith(element);
    expect(root.render).toHaveBeenNthCalledWith(1, 'a');
    expect(root.render).toHaveBeenNthCalledWith(2, 'b');

    handle.unmount();

    expect(root.unmount).toHaveBeenCalledTimes(1);

    // Rendering again after the unmount creates a new root
    handle.render('c');

    expect(module.createRoot).toHaveBeenCalledTimes(2);
  });

  test('mountReactNode() renders once the library is loaded, and unmounts', async () => {
    const unmount = mountReactNode(document.createElement('div'), 'node');

    await vi.waitFor(() => {
      expect(root.render).toHaveBeenCalledWith('node');
    });

    unmount();

    expect(root.unmount).toHaveBeenCalledTimes(1);
  });

  test('mountReactNode() renders nothing if it is unmounted while loading', async () => {
    const unmount = mountReactNode(document.createElement('div'), 'node');

    unmount();
    await loadReactDom();
    await Promise.resolve();

    expect(root.render).not.toHaveBeenCalled();
    expect(root.unmount).not.toHaveBeenCalled();
  });

  test('mountReactNode() reports a failure to load the library', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const error = new Error('offline');

    vi.mocked(loadChunk).mockRejectedValue(error);
    mountReactNode(document.createElement('div'), 'node');

    await vi.waitFor(() => {
      expect(spy).toHaveBeenCalledWith(error);
    });
  });
});
