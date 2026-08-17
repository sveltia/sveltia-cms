/**
 * Maximum number of API requests to have in flight at the same time. GitHub’s secondary rate limit
 * rejects more than 100 concurrent requests, and other services throttle bursts as well, so keep
 * well below that. Anything under this number is unaffected, because the whole list starts at once.
 * @see https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api#about-secondary-rate-limits
 */
export const MAX_CONCURRENT_REQUESTS = 10;

/**
 * Run the given task for each item, keeping at most {@link MAX_CONCURRENT_REQUESTS} of them in
 * flight, so a long list doesn’t trigger a Too Many Requests error. Unlike a chunked loop, a worker
 * picks up the next item as soon as it’s free, so one slow task doesn’t stall the others.
 * @template T
 * @param {T[]} items Items to process.
 * @param {(item: T) => Promise<void>} task Task to be performed for each item.
 */
export const runConcurrently = async (items, task) => {
  let cursor = 0;

  /**
   * Take items off the list until it’s exhausted.
   */
  const work = async () => {
    while (cursor < items.length) {
      const item = items[cursor];

      cursor += 1;
      // eslint-disable-next-line no-await-in-loop
      await task(item);
    }
  };

  await Promise.all(
    Array(Math.min(MAX_CONCURRENT_REQUESTS, items.length))
      .fill(undefined)
      .map(() => work()),
  );
};
