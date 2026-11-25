import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  createConcurrencyLimiter,
  createLatestGuard,
  mapConcurrently,
  MAX_CONCURRENT_REQUESTS,
  runConcurrently,
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

  test('starts the most recently queued task first when asked to', async () => {
    const limit = createConcurrencyLimiter(1, { lastInFirstOut: true });
    const deferreds = [0, 1, 2, 3].map(() => Promise.withResolvers());
    /** @type {number[]} */
    const started = [];

    const results = deferreds.map(({ promise }, index) =>
      limit(() => {
        started.push(index);

        return promise;
      }),
    );

    await Promise.resolve();
    expect(started).toEqual([0]);

    deferreds.forEach(({ resolve }) => resolve('done'));
    await Promise.all(results);
    expect(started).toEqual([0, 3, 2, 1]);
  });

  test.each([
    [false, [0, 2, 1, 3]],
    [true, [0, 2, 3, 1]],
  ])('moves a queued task up when prioritized (last in, first out: %s)', async (lifo, order) => {
    const limit = createConcurrencyLimiter(1, { lastInFirstOut: lifo });
    const deferreds = [0, 1, 2, 3].map(() => Promise.withResolvers());
    /** @type {number[]} */
    const started = [];

    const results = deferreds.map(({ promise }, index) =>
      limit(
        () => {
          started.push(index);

          return promise;
        },
        // The second task is queued without a key
        { key: index === 1 ? undefined : `task-${index}` },
      ),
    );

    await Promise.resolve();
    // The running task, an unknown key and a missing one are left alone
    limit.prioritize('task-0');
    limit.prioritize('missing');
    limit.prioritize(undefined);
    limit.prioritize('task-2');

    deferreds.forEach(({ resolve }) => resolve('done'));
    await Promise.all(results);
    expect(started).toEqual(order);
  });
});

describe('runConcurrently() and mapConcurrently()', () => {
  test('runs every item exactly once', async () => {
    const items = Array(25)
      .fill(undefined)
      .map((_item, index) => index);

    /** @type {number[]} */
    const processed = [];

    await runConcurrently(items, async (item) => {
      processed.push(item);
    });

    expect(processed.toSorted((a, b) => a - b)).toEqual(items);
  });

  test('keeps the number of requests in flight under the limit', async () => {
    /** @type {(() => void)[]} */
    const resolvers = [];
    let inFlight = 0;
    let peak = 0;

    const promise = runConcurrently(
      Array(30).fill(undefined),
      () =>
        new Promise((resolve) => {
          inFlight += 1;
          peak = Math.max(peak, inFlight);

          resolvers.push(() => {
            inFlight -= 1;
            resolve();
          });
        }),
    );

    // Release the pending tasks one by one, so a worker picks up the next item each time
    while (resolvers.length) {
      /** @type {any} */ (resolvers.shift())();
      // eslint-disable-next-line no-await-in-loop
      await Promise.resolve();
    }

    await promise;
    expect(peak).toBe(MAX_CONCURRENT_REQUESTS);
  });

  test('honours a lower limit', async () => {
    /** @type {(() => void)[]} */
    const resolvers = [];
    let inFlight = 0;
    let peak = 0;

    const promise = runConcurrently(
      Array(12).fill(undefined),
      () =>
        new Promise((resolve) => {
          inFlight += 1;
          peak = Math.max(peak, inFlight);

          resolvers.push(() => {
            inFlight -= 1;
            resolve();
          });
        }),
      { concurrency: 3 },
    );

    while (resolvers.length) {
      /** @type {any} */ (resolvers.shift())();
      // eslint-disable-next-line no-await-in-loop
      await Promise.resolve();
    }

    await promise;
    expect(peak).toBe(3);
  });

  test('does nothing for an empty list', async () => {
    let called = false;

    await runConcurrently([], async () => {
      called = true;
    });

    expect(called).toBe(false);
  });

  test('maps the items in input order, whatever order the tasks finish in', async () => {
    /** @type {number[]} */
    const finished = [];
    let inFlight = 0;
    let peak = 0;

    const results = await mapConcurrently(
      [30, 10, 20, 0],
      async (delay) => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise((resolve) => {
          setTimeout(resolve, delay);
        });
        inFlight -= 1;
        finished.push(delay);

        return delay * 2;
      },
      { concurrency: 2 },
    );

    expect(results).toEqual([60, 20, 40, 0]);
    expect(finished).not.toEqual([30, 10, 20, 0]);
    expect(peak).toBe(2);
  });

  test('returns an empty list for an empty list', async () => {
    expect(await mapConcurrently([], async () => 1)).toEqual([]);
  });
});
