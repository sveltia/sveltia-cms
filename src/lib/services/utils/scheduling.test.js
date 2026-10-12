import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  createConcurrencyLimiter,
  createLatestGuard,
  runInChunks,
  yieldToMain,
} from './scheduling';

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

  test('processes every item in order, yielding once the budget is spent', async () => {
    const yieldFn = vi.fn(async () => undefined);
    let now = 0;

    vi.stubGlobal('scheduler', { yield: yieldFn });
    vi.spyOn(performance, 'now').mockImplementation(() => now);

    /** @type {number[]} */
    const seen = [];
    const items = Array.from({ length: 7 }, (_, index) => index);

    await runInChunks(
      items,
      (item) => {
        seen.push(item);
        // Each task takes 20 ms, so a budget of 50 ms is spent after three of them
        now += 20;
      },
      { budget: 50 },
    );

    expect(seen).toEqual(items);
    // Three tasks (60 ms), a yield, three more, a yield, the last one; none before the first
    expect(yieldFn).toHaveBeenCalledTimes(2);

    vi.mocked(performance.now).mockRestore();
  });

  test('waits for each asynchronous task before starting the next', async () => {
    /** @type {string[]} */
    const log = [];

    await runInChunks([1, 2, 3], async (item) => {
      log.push(`start ${item}`);
      await Promise.resolve();
      log.push(`end ${item}`);
    });

    expect(log).toEqual(['start 1', 'end 1', 'start 2', 'end 2', 'start 3', 'end 3']);
  });

  test('does nothing for an empty list', async () => {
    const task = vi.fn();

    await runInChunks([], task);

    expect(task).not.toHaveBeenCalled();
  });
});

describe('createLatestGuard()', () => {
  test('tells whether a call is still the latest one', () => {
    const guard = createLatestGuard();
    const isFirstLatest = guard.next();

    expect(isFirstLatest()).toBe(true);

    const isSecondLatest = guard.next();

    expect(isFirstLatest()).toBe(false);
    expect(isSecondLatest()).toBe(true);
  });

  test('keeps the calls of each guard apart', () => {
    const guard = createLatestGuard();
    const isLatest = guard.next();

    createLatestGuard().next();

    expect(isLatest()).toBe(true);
  });
});

describe('createConcurrencyLimiter()', () => {
  test('runs at most the given number of tasks at once, in order', async () => {
    const limit = createConcurrencyLimiter(2);
    const deferreds = [0, 1, 2, 3, 4].map(() => Promise.withResolvers());
    /** @type {number[]} */
    const started = [];

    const results = deferreds.map(({ promise }, index) =>
      limit(() => {
        started.push(index);

        return promise;
      }),
    );

    await Promise.resolve();
    expect(started).toEqual([0, 1]);

    deferreds[0].resolve('done');
    await expect(results[0]).resolves.toBe('done');
    await vi.waitFor(() => expect(started).toEqual([0, 1, 2]));

    // A failed task frees its slot as well
    deferreds[1].reject(new Error('failed'));
    await expect(results[1]).rejects.toThrow('failed');
    await vi.waitFor(() => expect(started).toEqual([0, 1, 2, 3]));

    deferreds.slice(2).forEach(({ resolve }) => resolve('done'));
    await expect(Promise.all(results.slice(2))).resolves.toEqual(['done', 'done', 'done']);
    expect(started).toEqual([0, 1, 2, 3, 4]);

    // The slots are free again once everything has settled
    await expect(limit(async () => 'next')).resolves.toBe('next');
  });
});
