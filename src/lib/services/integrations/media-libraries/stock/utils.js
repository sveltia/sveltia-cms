import { locale as appLocale } from '@sveltia/i18n';

import { fetchPages } from '$lib/services/integrations/media-libraries/paging';
import { getLanguageScript } from '$lib/services/utils/locale';

/**
 * @import { ExternalAsset, MediaLibraryFetchOptions } from '$lib/types/private';
 */

/**
 * Get the best matching locale supported by a stock asset API: the app locale if the API supports
 * it, otherwise the first supported locale of the same language written in the same script, so
 * Traditional Chinese doesn’t get Simplified Chinese results, otherwise the first supported locale
 * of the same language, otherwise the fallback.
 * @param {string[]} supportedLocales Locale codes supported by the API, either language codes like
 * `en` or language-region codes like `en-US`.
 * @param {string} fallback Locale code to fall back to.
 * @returns {string} Locale code.
 */
export const getSupportedLocale = (supportedLocales, fallback) => {
  const locale = appLocale.current.toLowerCase();
  const [lang] = locale.split('-');
  const languageScript = getLanguageScript(locale);

  return (
    supportedLocales.find((code) => code.toLowerCase() === locale) ??
    (languageScript
      ? supportedLocales.find((code) => getLanguageScript(code) === languageScript)
      : undefined) ??
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
export const fetchPagedResults = async ({ maxPages, fetchPage, parsePage }) =>
  fetchPages(
    async (/** @type {number | undefined} */ cursor) => {
      const page = cursor ?? 1;
      const { results, hasMore } = parsePage(await fetchPage(page), page);

      return { results, next: hasMore ? page + 1 : undefined };
    },
    { maxPages },
  );

/**
 * Create the `list` and `search` functions of a stock asset provider whose API lists curated
 * pictures at one endpoint and searches pictures at another.
 * @template T
 * @param {object} args Arguments.
 * @param {string} args.listURL Endpoint to list curated pictures.
 * @param {string} args.searchURL Endpoint to search pictures.
 * @param {(apiKey: string) => Record<string, string>} [args.getHeaders] Function to get the
 * request headers for the given API key. Default: no headers.
 * @param {(apiKey: string) => Record<string, any>} args.getListParams Function to get the query
 * parameters to list pictures.
 * @param {(query: string, apiKey: string) => Record<string, any>} args.getSearchParams Function
 * to get the query parameters to search pictures.
 * @param {string} [args.listKey] Property of the list response holding the results. Default: the
 * response itself.
 * @param {string} args.searchKey Property of the search response holding the results.
 * @param {(response: any, page: number) => boolean} [args.hasMore] Function to check whether
 * another search result page follows, for an API that pages the search results with the `page`
 * query parameter. Default: the results are fetched in a single request without the parameter.
 * @param {number} [args.maxPages] Maximum number of search result pages to fetch. Required with
 * `hasMore`.
 * @param {(results: T[]) => ExternalAsset[]} args.parseResults Function to convert the results
 * into the `ExternalAsset` format.
 * @returns {{
 * list: (options: MediaLibraryFetchOptions) => Promise<ExternalAsset[]>,
 * search: (query: string, options: MediaLibraryFetchOptions) => Promise<ExternalAsset[]>,
 * }} Functions.
 */
export const createStockFetchers = ({
  listURL,
  searchURL,
  getHeaders,
  getListParams,
  getSearchParams,
  listKey,
  searchKey,
  maxPages,
  hasMore,
  parseResults,
}) => {
  /**
   * Send a request to the API.
   * @param {string} url Endpoint.
   * @param {URLSearchParams} params Query parameters.
   * @param {string} apiKey API key.
   * @returns {Promise<any>} Parsed response.
   */
  const request = (url, params, apiKey) =>
    fetchJSON(`${url}?${params}`, getHeaders && { headers: getHeaders(apiKey) });

  return {
    /**
     * Fetch curated pictures.
     * @param {MediaLibraryFetchOptions} options Options.
     * @returns {Promise<ExternalAsset[]>} Assets.
     */
    list: async ({ apiKey }) => {
      const response = await request(listURL, new URLSearchParams(getListParams(apiKey)), apiKey);

      return parseResults(listKey ? response[listKey] : response);
    },
    /**
     * Search images.
     * @param {string} query Search query.
     * @param {MediaLibraryFetchOptions} options Options.
     * @returns {Promise<ExternalAsset[]>} Assets.
     */
    search: async (query, { apiKey }) => {
      const params = new URLSearchParams(getSearchParams(query, apiKey));

      if (!hasMore) {
        return parseResults((await request(searchURL, params, apiKey))[searchKey]);
      }

      const results = await fetchPagedResults({
        maxPages: /** @type {number} */ (maxPages),
        /**
         * Fetch a page of search results.
         * @param {number} page Page number.
         * @returns {Promise<any>} Response.
         */
        fetchPage: (page) => {
          params.set('page', String(page));

          return request(searchURL, params, apiKey);
        },
        /**
         * Extract the results from a page.
         * @param {any} response Response.
         * @param {number} page Page number.
         * @returns {{ results: T[], hasMore: boolean }} Results and whether another page follows.
         */
        parsePage: (response, page) => ({
          results: response[searchKey],
          hasMore: hasMore(response, page),
        }),
      });

      return parseResults(results);
    },
  };
};
