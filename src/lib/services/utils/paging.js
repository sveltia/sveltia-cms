import { sleep } from '@sveltia/utils/misc';

/**
 * Fetch results page by page, following the cursor each page returns, until a page has no next
 * cursor or the given number of pages is reached. Wait for a bit between pages to avoid hitting the
 * API rate limit, unless told otherwise.
 * @template T Result type.
 * @template C Cursor type, such as a continuation token, a URL or a page number.
 * @param {(cursor: C | undefined) => Promise<{ results: T[], next?: C | null }>} fetchPage
 * Function to fetch a page of results, given the cursor returned by the previous page, which is
 * `undefined` for the first page. The returned `next` cursor is empty on the last page.
 * @param {object} [options] Options.
 * @param {number} [options.maxPages] Maximum number of pages to fetch. Default: 10.
 * @param {number} [options.delay] Milliseconds to wait between pages, or `0` not to wait.
 * Default: 50.
 * @returns {Promise<{ results: T[], complete: boolean }>} Results of all the fetched pages, and
 * whether they are all of them: `false` if the reading stopped at the maximum number of pages while
 * another page followed.
 */
export const readPages = async (fetchPage, { maxPages = 10, delay = 50 } = {}) => {
  /** @type {T[]} */
  const results = [];
  /** @type {C | undefined} */
  let cursor;

  for (let page = 1; page <= maxPages; page += 1) {
    // eslint-disable-next-line no-await-in-loop
    const { results: pageResults, next } = await fetchPage(cursor);

    results.push(...pageResults);

    if (!next) {
      return { results, complete: true };
    }

    cursor = next;

    // Wait for a bit before requesting the next page
    if (delay && page < maxPages) {
      // eslint-disable-next-line no-await-in-loop
      await sleep(delay);
    }
  }

  return { results, complete: false };
};

/**
 * Fetch results page by page: see {@link readPages}.
 * @template T Result type.
 * @template C Cursor type, such as a continuation token, a URL or a page number.
 * @param {(cursor: C | undefined) => Promise<{ results: T[], next?: C | null }>} fetchPage
 * Function to fetch a page of results.
 * @param {object} [options] Options.
 * @param {number} [options.maxPages] Maximum number of pages to fetch. Default: 10.
 * @param {number} [options.delay] Milliseconds to wait between pages. Default: 50.
 * @returns {Promise<T[]>} Results of all the fetched pages.
 */
export const fetchPages = async (fetchPage, options) =>
  (await readPages(fetchPage, options)).results;

/**
 * Fetch results by page number, starting at 1, until a page comes back with fewer results than the
 * page size, which marks it as the last one: see {@link readPages}. This suits a REST API that
 * pages a list without saying how many pages there are.
 * @template T Result type.
 * @param {(page: number) => Promise<T[]>} fetchPage Function to fetch the results of a page.
 * @param {object} options Options.
 * @param {number} options.pageSize Number of results a full page holds.
 * @param {number} [options.maxPages] Maximum number of pages to fetch. Default: 10.
 * @param {number} [options.delay] Milliseconds to wait between pages. Default: 50.
 * @returns {Promise<{ results: T[], complete: boolean }>} Results of all the fetched pages, and
 * whether they are all of them.
 */
export const readNumberedPages = (fetchPage, { pageSize, ...options }) =>
  readPages(async (/** @type {number | undefined} */ page = 1) => {
    const results = await fetchPage(page);

    return { results, next: results.length < pageSize ? undefined : page + 1 };
  }, options);
