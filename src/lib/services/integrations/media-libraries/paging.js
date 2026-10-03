import { sleep } from '@sveltia/utils/misc';

/**
 * Fetch results page by page, following the cursor each page returns, until a page has no next
 * cursor or the given number of pages is reached. Wait for a bit between pages to avoid hitting the
 * API rate limit.
 * @template T Result type.
 * @template C Cursor type, such as a continuation token, a URL or a page number.
 * @param {(cursor: C | undefined) => Promise<{ results: T[], next?: C | null }>} fetchPage
 * Function to fetch a page of results, given the cursor returned by the previous page, which is
 * `undefined` for the first page. The returned `next` cursor is empty on the last page.
 * @param {object} [options] Options.
 * @param {number} [options.maxPages] Maximum number of pages to fetch. Default: 10.
 * @returns {Promise<T[]>} Results of all the fetched pages.
 */
export const fetchPages = async (fetchPage, { maxPages = 10 } = {}) => {
  /** @type {T[]} */
  const results = [];
  /** @type {C | undefined} */
  let cursor;

  for (let page = 1; page <= maxPages; page += 1) {
    // eslint-disable-next-line no-await-in-loop
    const { results: pageResults, next } = await fetchPage(cursor);

    results.push(...pageResults);

    if (!next || page === maxPages) {
      break;
    }

    cursor = next;

    // Wait for a bit before requesting the next page
    // eslint-disable-next-line no-await-in-loop
    await sleep(50);
  }

  return results;
};
