import { afterEach, describe, expect, test, vi } from 'vitest';

import { runInChunks, yieldToMain } from './scheduling';

describe('yieldToMain()', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('uses scheduler.yield() where available', async () => {
    const yieldFn = vi.fn(async () => undefined);

    vi.stubGlobal('scheduler', { yield: yieldFn });

    await yieldToMain();

    expect(yieldFn).toHaveBeenCalledOnce();
  });

  test('falls back to a macrotask elsewhere', async () => {
    vi.stubGlobal('scheduler', undefined);

    let macrotaskRan = false;

    setTimeout(() => {
      macrotaskRan = true;
    }, 0);

    await yieldToMain();

    // A yield resolves no earlier than the timeout queued before it
    expect(macrotaskRan).toBe(true);
  });
});

describe('runInChunks()', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('processes every item in order, yielding between chunks', async () => {
    const yieldFn = vi.fn(async () => undefined);

    vi.stubGlobal('scheduler', { yield: yieldFn });

    /** @type {number[]} */
    const seen = [];
    const items = Array.from({ length: 7 }, (_, index) => index);

    await runInChunks(
      items,
      (item) => {
        seen.push(item);
      },
      { chunkSize: 3 },
    );

    expect(seen).toEqual(items);
    // Three chunks (3 + 3 + 1) means two yields; none before the first chunk
    expect(yieldFn).toHaveBeenCalledTimes(2);
  });

  test('waits for asynchronous tasks within a chunk', async () => {
    /** @type {number[]} */
    const done = [];

    await runInChunks(
      [1, 2, 3],
      async (item) => {
        await Promise.resolve();
        done.push(item);
      },
      { chunkSize: 2 },
    );

    expect(done).toEqual([1, 2, 3]);
  });

  test('does nothing for an empty list', async () => {
    const task = vi.fn();

    await runInChunks([], task);

    expect(task).not.toHaveBeenCalled();
  });
});
