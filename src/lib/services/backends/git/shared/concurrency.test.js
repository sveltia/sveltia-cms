import { describe, expect, test } from 'vitest';

import {
  MAX_CONCURRENT_REQUESTS,
  runConcurrently,
} from '$lib/services/backends/git/shared/concurrency';

describe('backends/git/shared/concurrency', () => {
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

  test('does nothing for an empty list', async () => {
    let called = false;

    await runConcurrently([], async () => {
      called = true;
    });

    expect(called).toBe(false);
  });
});
