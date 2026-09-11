import { beforeEach, describe, expect, test, vi } from 'vitest';

import { loadChunk } from '$lib/services/app/dependencies';

import {
  _resetReactDom,
  getReactDom,
  loadReactDom,
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
