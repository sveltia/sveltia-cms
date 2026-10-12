import { fetchAPI } from '$lib/services/backends/git/shared/api';
import { getOrCreateAsync } from '$lib/services/utils/cache';

/**
 * The limits an instance applies to an API response, which it enforces by silently returning less
 * than what was asked for.
 * @typedef {object} ApiSettings
 * @property {number} [default_paging_num] Default number of items per page.
 * @property {number} [max_response_items] Maximum number of items in a response.
 * @property {number} [default_max_blob_size] Maximum size of a single blob whose content is
 * returned.
 * @property {number} [default_max_response_size] Maximum combined size of the contents in one
 * response. Gitea only; Forgejo has no such limit.
 */

/**
 * Number of items an instance returns per page unless configured otherwise, which is also the most
 * it lets a request ask for. A larger `limit` is silently clamped rather than refused.
 * @see https://docs.gitea.com/administration/config-cheat-sheet#api-api
 */
const DEFAULT_MAX_RESPONSE_ITEMS = 50;
/**
 * Maximum number of pages to read from a paginated list. Editorial Workflow is not meant to hold a
 * huge backlog, so this is a safety net against a runaway loop rather than a limit anyone should
 * reach.
 */
const MAX_PAGES = 10;
/**
 * Cache of the API settings request. It holds a single entry, as the settings are the same for the
 * whole instance; the request is cached rather than its result, so concurrent callers share it.
 * @type {Map<string, Promise<ApiSettings>>}
 */
const apiSettingsCache = new Map();

/**
 * Forget the API settings. Used in tests.
 */
export const _resetApiSettings = () => {
  apiSettingsCache.clear();
};

/**
 * Get the limits the instance applies to an API response. They’re asked once per session; a failed
 * request isn’t remembered, so a later call can try again.
 * @returns {Promise<ApiSettings>} API settings.
 * @see https://docs.gitea.com/api/next/#tag/settings/operation/getGeneralAPISettings
 */
export const getApiSettings = () =>
  getOrCreateAsync(
    apiSettingsCache,
    'settings',
    async () => /** @type {ApiSettings} */ (await fetchAPI('/settings/api')),
  );

/**
 * Get the page size the instance applies to a list. The default is used if the instance doesn’t
 * report it. Every list is fetched with it, because the instance cuts a larger page short without
 * saying so.
 * @returns {Promise<number>} Page size.
 */
const getPageSize = async () =>
  Number((await getApiSettings()).max_response_items) || DEFAULT_MAX_RESPONSE_ITEMS;

/**
 * Fetch the items of a paginated list. The instance clamps the page size to what it’s configured
 * with, so the pages are requested at that size and read until one comes back short, rather than
 * asking for one large page and silently losing whatever didn’t fit.
 * @param {string} path API endpoint path, with any query parameters of its own.
 * @returns {Promise<{ items: Record<string, any>[], complete: boolean }>} Items, and whether they
 * are all of them: the reading stops at {@link MAX_PAGES} pages, which may leave some out.
 */
export const fetchPages = async (path) => {
  const limit = await getPageSize();
  const separator = path.includes('?') ? '&' : '?';
  /** @type {Record<string, any>[]} */
  const items = [];

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const result = /** @type {Record<string, any>[]} */ (
      // eslint-disable-next-line no-await-in-loop
      await fetchAPI(`${path}${separator}page=${page}&limit=${limit}`)
    );

    items.push(...result);

    if (result.length < limit) {
      return { items, complete: true };
    }
  }

  return { items, complete: false };
};

/**
 * Fetch every item of a paginated list, up to {@link MAX_PAGES} pages: see {@link fetchPages}.
 * @param {string} path API endpoint path, with any query parameters of its own.
 * @returns {Promise<Record<string, any>[]>} Items.
 */
export const fetchAllPages = async (path) => (await fetchPages(path)).items;
