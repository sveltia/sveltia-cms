import { get } from 'svelte/store';
import { locale as appLocale } from 'svelte-i18n';

/**
 * @import {
 * ExternalAsset,
 * MediaLibraryFetchOptions,
 * MediaLibraryService,
 * } from '$lib/types/private';
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
      fileName: /** @type {string} */ (previewURL.split('/').pop()).replace('_150.', '_1280.'),
      kind: 'image',
      credit: `<a href="${pageURL}">Photo by ${user} on Pixabay`,
    }),
  );

/**
 * Get the best matching locale supported by Pixabay API.
 * @returns {string} Locale code.
 */
export const getLocale = () => {
  const [locale] = /** @type {string} */ (get(appLocale)).toLowerCase().split('-');

  return SUPPORTED_LOCALES.includes(locale) ? locale : 'en';
};

/**
 * Fetch curated pictures.
 * @param {MediaLibraryFetchOptions} options Options.
 * @returns {Promise<ExternalAsset[]>} Assets.
 * @see https://pixabay.com/api/docs/
 * @todo Support video files.
 */
export const list = async ({ apiKey }) => {
  const params = new URLSearchParams({
    ...SEARCH_PARAMS,
    key: apiKey,
    lang: getLocale(),
    editors_choice: String(true),
  });

  const response = await fetch(`${ENDPOINT}/?${params}`);

  if (!response.ok) {
    return Promise.reject();
  }

  /** @type {FetchResult[]} */
  const results = (await response.json()).hits;

  return parseResults(results);
};

/**
 * Search images or fetch curated pictures if no query is given.
 * @param {string} query Search query.
 * @param {MediaLibraryFetchOptions} options Options.
 * @returns {Promise<ExternalAsset[]>} Assets.
 * @see https://pixabay.com/api/docs/
 * @todo Support video files.
 */
export const search = async (query, { apiKey }) => {
  const params = new URLSearchParams({
    ...SEARCH_PARAMS,
    key: apiKey,
    lang: getLocale(),
    q: query,
  });

  const response = await fetch(`${ENDPOINT}/?${params}`);

  if (!response.ok) {
    return Promise.reject();
  }

  /** @type {FetchResult[]} */
  const results = (await response.json()).hits;

  return parseResults(results);
};

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
