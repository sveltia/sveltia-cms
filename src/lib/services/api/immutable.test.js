import * as immutableLib from 'immutable';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { loadModule } from '$lib/services/app/dependencies';

import {
  _resetImmutable,
  getImmutable,
  immutableLoaded,
  loadImmutable,
  preloadImmutable,
} from './immutable';

vi.mock('$lib/services/app/dependencies', () => ({
  getUnpkgURL: vi.fn(() => ''),
  loadModule: vi.fn(),
}));

describe('Immutable.js loader', () => {
  beforeEach(() => {
    _resetImmutable();
    vi.mocked(loadModule).mockResolvedValue(immutableLib);
  });

  test('loads the library from the CDN once', async () => {
    expect(immutableLoaded.current).toBe(false);

    const [first, second] = await Promise.all([loadImmutable(), loadImmutable()]);

    expect(first).toBe(immutableLib);
    expect(second).toBe(immutableLib);
    expect(loadModule).toHaveBeenCalledOnce();
    expect(loadModule).toHaveBeenCalledWith('immutable', 'dist/immutable.es.js');
    expect(immutableLoaded.current).toBe(true);

    await loadImmutable();
    expect(loadModule).toHaveBeenCalledOnce();
  });

  test('preloads without surfacing a failure', async () => {
    vi.mocked(loadModule).mockRejectedValue(new Error('offline'));

    // Neither call must reject; the error is reported when the library is needed
    expect(() => preloadImmutable()).not.toThrow();
    await Promise.resolve();
    await expect(loadImmutable()).rejects.toThrow('offline');
    expect(immutableLoaded.current).toBe(false);

    // A failed load isn’t cached, so the next call tries again
    vi.mocked(loadModule).mockResolvedValue(immutableLib);
    expect(await loadImmutable()).toBe(immutableLib);
    expect(immutableLoaded.current).toBe(true);
  });

  test('preloads the module for a later synchronous read', async () => {
    preloadImmutable();
    await loadImmutable();

    expect(loadModule).toHaveBeenCalledOnce();
    expect(getImmutable()).toBe(immutableLib);
  });

  test('throws when the module is read before it’s loaded', async () => {
    expect(() => getImmutable()).toThrow('Immutable.js is not loaded yet');

    await loadImmutable();
    expect(getImmutable()).toBe(immutableLib);
  });
});
