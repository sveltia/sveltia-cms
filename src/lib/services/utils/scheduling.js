import { sleep } from '@sveltia/utils/misc';

/**
 * Hand control back to the browser so it can paint and handle input, then continue. Long
 * CPU-bound loops call this between chunks of work, which keeps the tab responsive and the progress
 * indicator moving. `scheduler.yield()` resumes ahead of other queued tasks where it’s supported;
 * a zero-delay timeout is used elsewhere.
 * @returns {Promise<void>} Resolves once the browser has had a chance to run other work.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Scheduler/yield
 */
export const yieldToMain = async () => {
  const { scheduler } = /** @type {{ scheduler?: { yield?: () => Promise<void> } }} */ (globalThis);

  if (typeof scheduler?.yield === 'function') {
    await scheduler.yield();
  } else {
    await sleep();
  }
};

/**
 * Run the given task for each item, a chunk at a time, yielding to the browser between chunks. Use
 * this for a large batch of synchronous work that would otherwise block the main thread for the
 * whole batch. Within a chunk, the tasks run concurrently, so they may be asynchronous as well.
 * @template T
 * @param {T[]} items Items to process.
 * @param {(item: T) => Promise<void> | void} task Task to be performed for each item.
 * @param {object} [options] Options.
 * @param {number} [options.chunkSize] Number of items to process before yielding.
 */
export const runInChunks = async (items, task, { chunkSize = 200 } = {}) => {
  for (let index = 0; index < items.length; index += chunkSize) {
    if (index) {
      // eslint-disable-next-line no-await-in-loop
      await yieldToMain();
    }

    // eslint-disable-next-line no-await-in-loop
    await Promise.all(items.slice(index, index + chunkSize).map((item) => task(item)));
  }
};

/**
 * Create a guard telling whether an async call is still the latest one. A slow call made earlier,
 * e.g. a lookup for an asset focused before, can finish after a later one, and its result must not
 * replace the later one’s. Call `next()` at the start of each call, and check the function it
 * returns after every `await`.
 * @returns {{ next: () => () => boolean }} Guard. `next()` starts a new call and returns a function
 * telling whether no call has been started since.
 * @example
 * const guard = createLatestGuard();
 *
 * const update = async () => {
 *   const isLatest = guard.next();
 *   const result = await fetchSomething();
 *
 *   if (!isLatest()) {
 *     return;
 *   }
 *
 *   // Use the result
 * };
 */
export const createLatestGuard = () => {
  let count = 0;

  return {
    /**
     * Start a new call.
     * @returns {() => boolean} Function telling whether no call has been started since.
     */
    next: () => {
      count += 1;

      const call = count;

      return () => call === count;
    },
  };
};
