import {
  createStockFetchers,
  getSupportedLocale,
} from '$lib/services/integrations/media-libraries/stock/utils';
import { escapeAttr, escapeHTML } from '$lib/services/utils/string';

/**
 * @import { ExternalAsset, MediaLibraryService } from '$lib/types/private';
 */

/**
 * @typedef {object} FetchResult
 * @property {number} id Asset ID.
 * @property {string} url Page URL.
 * @property {string} alt Description.
 * @property {{ large2x: string, medium: string }} src Image URLs.
 * @property {string} photographer Photographer name.
 */

/**
 * @see https://www.pexels.com/api/documentation/#photos-search__parameters__locale
 */
const SUPPORTED_LOCALES = [
  'en-US,pt-BR,es-ES,ca-ES,de-DE,it-IT,fr-FR,sv-SE,id-ID,pl-PL,ja-JP,zh-TW,zh-CN,ko-KR,th-TH,nl-NL',
  'hu-HU,vi-VN,cs-CZ,da-DK,fi-FI,uk-UA,el-GR,ro-RO,nb-NO,sk-SK,tr-TR,ru-RU',
]
  .join(',')
  .split(',');

const ENDPOINT = 'https://api.pexels.com/v1';

/** @type {Record<string, any>} */
const SEARCH_PARAMS = {
  per_page: 80,
};

const DESCRIPTION_REGEX = /\/photo\/(?<alt>.+?)-\d+\/$/;

/**
 * Get the best matching locale supported by Pexels API.
 * @returns {string} Locale code.
 */
export const getLocale = () => getSupportedLocale(SUPPORTED_LOCALES, 'en-US');

/**
 * Parse API results into ExternalAsset format.
 * @param {FetchResult[]} results API results.
 * @returns {ExternalAsset[]} Assets.
 */
export const parseResults = (results) =>
  results.map(({ id, url, alt, src: { large2x, medium }, photographer }) => ({
    id: String(id),
    description: url.match(DESCRIPTION_REGEX)?.groups?.alt.replace(/-/g, ' ') ?? alt,
    previewURL: medium,
    downloadURL: large2x,
    fileName: `pexels-${photographer.split(/\s+/).join('-').toLowerCase()}-${id}.jpg`,
    kind: 'image',
    credit: `<a href="${escapeAttr(url)}">Photo by ${escapeHTML(photographer)} on Pexels</a>`,
  }));

/**
 * Fetch curated pictures, or search images.
 * @see https://www.pexels.com/api/documentation/
 * @todo Support video files.
 */
export const { list, search } = createStockFetchers({
  listURL: `${ENDPOINT}/curated`,
  searchURL: `${ENDPOINT}/search`,
  /**
   * Get the request headers.
   * @param {string} apiKey API key.
   * @returns {Record<string, string>} Headers.
   */
  getHeaders: (apiKey) => ({ Authorization: apiKey }),
  /**
   * Get the query parameters to list curated pictures.
   * @returns {Record<string, any>} Parameters.
   */
  getListParams: () => SEARCH_PARAMS,
  /**
   * Get the query parameters to search images.
   * @param {string} query Search query.
   * @returns {Record<string, any>} Parameters.
   */
  getSearchParams: (query) => ({ ...SEARCH_PARAMS, query, locale: getLocale() }),
  listKey: 'photos',
  searchKey: 'photos',
  maxPages: 2,
  /**
   * Check whether another page of search results follows.
   * @param {{ next_page?: string }} response Response.
   * @returns {boolean} Result.
   */
  hasMore: ({ next_page: nextPage }) => !!nextPage,
  parseResults,
});

/**
 * @type {MediaLibraryService}
 */
export default {
  serviceType: 'stock_assets',
  serviceId: 'pexels',
  serviceLabel: 'Pexels',
  serviceURL: 'https://www.pexels.com/',
  showServiceLink: true,
  hotlinking: false,
  authType: 'api_key',
  developerURL: 'https://www.pexels.com/api/',
  apiKeyURL: 'https://www.pexels.com/api/new/',
  apiKeyPattern: /^[a-zA-Z\d]{56}$/,
  list,
  search,
};
