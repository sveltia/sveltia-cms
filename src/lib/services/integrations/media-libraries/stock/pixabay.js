import {
  createStockFetchers,
  getSupportedLocale,
} from '$lib/services/integrations/media-libraries/stock/utils';
import { getBaseName } from '$lib/services/utils/file';
import { escapeAttr, escapeHTML } from '$lib/services/utils/string';

/**
 * @import { ExternalAsset, MediaLibraryService } from '$lib/types/private';
 */

/**
 * @typedef {object} FetchResult
 * @property {number} id Asset ID.
 * @property {string} webformatURL Image URL.
 * @property {string} previewURL Preview URL.
 * @property {string} largeImageURL Large image URL.
 * @property {number} imageWidth Image width.
 * @property {number} imageHeight Image height.
 * @property {string} pageURL Page URL.
 * @property {string} tags Tags.
 * @property {string} user User name.
 */

/**
 * @see https://pixabay.com/api/docs/#api_search_images
 */
const SUPPORTED_LOCALES =
  'cs,da,de,en,es,fr,id,it,hu,nl,no,pl,pt,ro,sk,fi,sv,tr,vi,th,bg,ru,el,ja,ko,zh'.split(',');

const ENDPOINT = 'https://pixabay.com/api';

/** @type {Record<string, any>} */
const SEARCH_PARAMS = {
  image_type: 'photo',
  min_width: 1280,
  safesearch: true,
  per_page: 150,
};

/**
 * Parse API results into ExternalAsset format.
 * @param {FetchResult[]} results API results.
 * @returns {ExternalAsset[]} Assets.
 */
export const parseResults = (results) =>
  results.map(
    ({
      id,
      webformatURL,
      previewURL,
      largeImageURL,
      imageWidth,
      imageHeight,
      pageURL,
      tags,
      user,
    }) => ({
      id: String(id),
      description: tags,
      previewURL: webformatURL.replace('_640.', imageWidth > imageHeight ? '_180.' : '_340.'),
      downloadURL: largeImageURL,
      fileName: getBaseName(previewURL).replace('_150.', '_1280.'),
      kind: 'image',
      credit: `<a href="${escapeAttr(pageURL)}">Photo by ${escapeHTML(user)} on Pixabay</a>`,
    }),
  );

/**
 * Get the best matching locale supported by Pixabay API.
 * @returns {string} Locale code.
 */
export const getLocale = () => getSupportedLocale(SUPPORTED_LOCALES, 'en');

/**
 * Fetch curated pictures, or search images.
 * @see https://pixabay.com/api/docs/
 * @todo Support video files.
 */
export const { list, search } = createStockFetchers({
  listURL: `${ENDPOINT}/`,
  searchURL: `${ENDPOINT}/`,
  /**
   * Get the query parameters to list editors’ choice pictures.
   * @param {string} apiKey API key.
   * @returns {Record<string, any>} Parameters.
   */
  getListParams: (apiKey) => ({
    ...SEARCH_PARAMS,
    key: apiKey,
    lang: getLocale(),
    editors_choice: String(true),
  }),
  /**
   * Get the query parameters to search images.
   * @param {string} query Search query.
   * @param {string} apiKey API key.
   * @returns {Record<string, any>} Parameters.
   */
  getSearchParams: (query, apiKey) => ({
    ...SEARCH_PARAMS,
    key: apiKey,
    lang: getLocale(),
    q: query,
  }),
  listKey: 'hits',
  searchKey: 'hits',
  parseResults,
});

/**
 * @type {MediaLibraryService}
 */
export default {
  serviceType: 'stock_assets',
  serviceId: 'pixabay',
  serviceLabel: 'Pixabay',
  serviceURL: 'https://pixabay.com/',
  showServiceLink: true,
  hotlinking: false,
  authType: 'api_key',
  developerURL: 'https://pixabay.com/service/about/api/',
  apiKeyURL: 'https://pixabay.com/api/docs/#api_key',
  apiKeyPattern: /^\d+-[a-f\d]{25}$/,
  list,
  search,
};
