import { sleep } from '@sveltia/utils/misc';

/**
 * @import { ConcurrencyLimiter, ConcurrencyLimiterTaskOptions } from '$lib/types/private';
 */

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
 * Run the given task for each item, one after another, yielding to the browser whenever the tasks
 * have kept the main thread busy for a while. Use this for a large batch of synchronous work that
 * would otherwise block the main thread for the whole batch. The work is split by time rather than
 * by a number of items, as items can take very different times: a large file takes much longer to
 * parse than a small one. The tasks may be asynchronous as well.
 * @template T
 * @param {T[]} items Items to process.
 * @param {(item: T) => Promise<void> | void} task Task to be performed for each item.
 * @param {object} [options] Options.
 * @param {number} [options.budget] How long to keep the main thread busy before yielding, in
 * milliseconds. The default is the threshold of a long task: yielding more often would slow the
 * work down where `scheduler.yield()` isn’t supported, as a timeout takes a few milliseconds.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/PerformanceLongTaskTiming
 */
export const runInChunks = async (items, task, { budget = 50 } = {}) => {
  let start = performance.now();

  for (let index = 0; index < items.length; index += 1) {
    if (performance.now() - start >= budget) {
      // eslint-disable-next-line no-await-in-loop
      await yieldToMain();
      start = performance.now();
    }

    // eslint-disable-next-line no-await-in-loop
    await task(items[index]);
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

/**
 * Create a function that runs the tasks given to it with at most a certain number of them in flight
 * at the same time, starting each queued task as soon as an earlier one has settled. Use this for
 * memory-heavy work requested from many places at once, such as decoding full-size images, which
 * would otherwise all be held in memory together.
 * @param {number} concurrency Maximum number of tasks in flight.
 * @param {object} [options] Options.
 * @param {boolean} [options.lastInFirstOut] Whether to start the most recently queued task first,
 * rather than the oldest one. This suits work requested for what’s on screen, like the thumbnails
 * of a list being scrolled: what was asked for last is what the user is looking at now.
 * @returns {ConcurrencyLimiter} Function running a task when there is room, and resolving or
 * rejecting with its outcome. Its `prioritize()` method makes the queued task with the given key,
 * if any, the next one to start, e.g. when it’s asked for again.
 */
export const createConcurrencyLimiter = (concurrency, { lastInFirstOut = false } = {}) => {
  let running = 0;
  /** @type {{ start: () => void, key: any }[]} */
  const queue = [];

  /**
   * Run the given task when there is room.
   * @template T
   * @param {() => Promise<T>} task Task.
   * @param {ConcurrencyLimiterTaskOptions} [options] Options.
   * @returns {Promise<T>} Outcome of the task.
   */
  const limit = async (task, { key = undefined } = {}) => {
    if (running >= concurrency) {
      await /** @type {Promise<void>} */ (
        new Promise((resolve) => {
          queue.push({ start: resolve, key });
        })
      );
    } else {
      running += 1;
    }

    try {
      return await task();
    } finally {
      // Hand the slot straight to the next task in the queue, if any, so the count stays the same
      const next = lastInFirstOut ? queue.pop() : queue.shift();

      if (next) {
        next.start();
      } else {
        running -= 1;
      }
    }
  };

  /**
   * Make the queued task with the given key, if any, the next one to start.
   * @param {any} key Task key.
   */
  const prioritize = (key) => {
    // A task queued without a key can’t be singled out
    const index = key === undefined ? -1 : queue.findIndex((item) => item.key === key);

    if (index > -1) {
      const [item] = queue.splice(index, 1);

      if (lastInFirstOut) {
        queue.push(item);
      } else {
        queue.unshift(item);
      }
    }
  };

  return Object.assign(limit, { prioritize });
};
