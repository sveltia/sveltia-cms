import { locale as appLocale } from '@sveltia/i18n';
import { sleep } from '@sveltia/utils/misc';

/**
 * Get the best matching locale supported by a stock asset API: the app locale if the API supports
 * it, otherwise the first supported locale of the same language, otherwise the fallback.
 * @param {string[]} supportedLocales Locale codes supported by the API, either language codes like
 * `en` or language-region codes like `en-US`.
 * @param {string} fallback Locale code to fall back to.
 * @returns {string} Locale code.
 */
export const getSupportedLocale = (supportedLocales, fallback) => {
  const locale = appLocale.current.toLowerCase();
  const [lang] = locale.split('-');

  return (
    supportedLocales.find((code) => code.toLowerCase() === locale) ??
    supportedLocales.find((code) => code.split('-')[0] === lang) ??
    fallback
  );
};

/**
 * Send a request to a stock asset API and parse the JSON response.
 * @param {string} url Request URL.
 * @param {RequestInit} [init] Request options.
 * @returns {Promise<any>} Parsed response.
 * @throws {Error} When the request failed.
 */
export const fetchJSON = async (url, init) => {
  const response = init ? await fetch(url, init) : await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return response.json();
};

/**
 * Fetch search results page by page, until the API reports no more pages or the given number of
 * pages is reached.
 * @template T
 * @param {object} args Arguments.
 * @param {number} args.maxPages Maximum number of pages to fetch.
 * @param {(page: number) => Promise<any>} args.fetchPage Function to fetch a page of results.
 * @param {(response: any, page: number) => { results: T[], hasMore: boolean }} args.parsePage
 * Function to extract the results from a page, along with whether another page follows.
 * @returns {Promise<T[]>} Results of all the fetched pages.
 */
export const fetchPagedResults = async ({ maxPages, fetchPage, parsePage }) => {
  /** @type {T[]} */
  const results = [];

  for (let page = 1; page <= maxPages; page += 1) {
    // eslint-disable-next-line no-await-in-loop
    const { results: pagedResults, hasMore } = parsePage(await fetchPage(page), page);

    results.push(...pagedResults);

    if (!hasMore || page === maxPages) {
      break;
    }

    // Wait for a bit before requesting the next page
    // eslint-disable-next-line no-await-in-loop
    await sleep(50);
  }

  return results;
};
