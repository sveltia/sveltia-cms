import { describe, expect, test, vi } from 'vitest';

import { createLazyModule } from '$lib/services/api/lazy-module';

describe('createLazyModule', () => {
  test('starts out not loaded and `get` throws the given message', () => {
    const loader = vi.fn();
    const lazy = createLazyModule({ loader, notLoadedMessage: 'Library not loaded' });

    expect(lazy.loaded.current).toBe(false);
    expect(() => lazy.get()).toThrow(new Error('Library not loaded'));
    expect(loader).not.toHaveBeenCalled();
  });

  test('loads the module, marks it loaded and returns it from `get`', async () => {
    const module = { name: 'lib' };

    const lazy = createLazyModule({
      loader: vi.fn().mockResolvedValue(module),
      notLoadedMessage: 'Not loaded',
    });

    await expect(lazy.load()).resolves.toBe(module);
    expect(lazy.loaded.current).toBe(true);
    expect(lazy.get()).toBe(module);
  });

  test('calls the loader only once for concurrent and later loads', async () => {
    const module = { name: 'lib' };
    const deferred = Promise.withResolvers();
    const loader = vi.fn().mockReturnValue(deferred.promise);
    const lazy = createLazyModule({ loader, notLoadedMessage: 'Not loaded' });
    const first = lazy.load();
    const second = lazy.load();

    expect(lazy.loaded.current).toBe(false);
    deferred.resolve(module);
    await expect(first).resolves.toBe(module);
    await expect(second).resolves.toBe(module);
    await expect(lazy.load()).resolves.toBe(module);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  test('forgets a failed load so that a later call can try again', async () => {
    const module = { name: 'lib' };
    const error = new Error('Network error');
    const loader = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce(module);
    const lazy = createLazyModule({ loader, notLoadedMessage: 'Not loaded' });

    await expect(lazy.load()).rejects.toBe(error);
    expect(lazy.loaded.current).toBe(false);
    expect(() => lazy.get()).toThrow('Not loaded');

    await expect(lazy.load()).resolves.toBe(module);
    expect(loader).toHaveBeenCalledTimes(2);
    expect(lazy.loaded.current).toBe(true);
  });

  test('rejects every caller waiting on the same failed load', async () => {
    const deferred = Promise.withResolvers();
    const error = new Error('Network error');

    const lazy = createLazyModule({
      loader: vi.fn().mockReturnValue(deferred.promise),
      notLoadedMessage: 'Not loaded',
    });

    const first = lazy.load();
    const second = lazy.load();

    deferred.reject(error);
    await expect(first).rejects.toBe(error);
    await expect(second).rejects.toBe(error);
  });

  test('`preload` starts loading in the background', async () => {
    const module = { name: 'lib' };
    const loader = vi.fn().mockResolvedValue(module);
    const lazy = createLazyModule({ loader, notLoadedMessage: 'Not loaded' });

    lazy.preload();
    expect(loader).toHaveBeenCalledTimes(1);
    await expect(lazy.load()).resolves.toBe(module);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  test('`preload` swallows a failure and leaves it for `load` to report', async () => {
    const error = new Error('Network error');
    const loader = vi.fn().mockRejectedValue(error);
    const lazy = createLazyModule({ loader, notLoadedMessage: 'Not loaded' });
    const onUnhandled = vi.fn();

    process.on('unhandledRejection', onUnhandled);

    try {
      lazy.preload();
      await vi.waitFor(() => expect(loader).toHaveBeenCalledTimes(1));
      // Let the rejection settle
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
      expect(onUnhandled).not.toHaveBeenCalled();
      expect(lazy.loaded.current).toBe(false);
      await expect(lazy.load()).rejects.toBe(error);
      expect(loader).toHaveBeenCalledTimes(2);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });

  test('`reset` forgets the loaded module so that the next load calls the loader again', async () => {
    const loader = vi.fn().mockResolvedValueOnce({ v: 1 }).mockResolvedValueOnce({ v: 2 });
    const lazy = createLazyModule({ loader, notLoadedMessage: 'Not loaded' });

    await lazy.load();
    lazy.reset();
    expect(lazy.loaded.current).toBe(false);
    expect(() => lazy.get()).toThrow('Not loaded');
    await expect(lazy.load()).resolves.toEqual({ v: 2 });
    expect(lazy.get()).toEqual({ v: 2 });
    expect(loader).toHaveBeenCalledTimes(2);
  });

  test('keeps each loader’s state separate', async () => {
    const a = createLazyModule({
      loader: vi.fn().mockResolvedValue('a'),
      notLoadedMessage: 'A not loaded',
    });

    const b = createLazyModule({
      loader: vi.fn().mockResolvedValue('b'),
      notLoadedMessage: 'B not loaded',
    });

    await a.load();
    expect(a.get()).toBe('a');
    expect(b.loaded.current).toBe(false);
    expect(() => b.get()).toThrow('B not loaded');
  });
});
