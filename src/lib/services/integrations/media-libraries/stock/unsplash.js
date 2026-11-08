import {
  createStockFetchers,
  fetchJSON,
  getSupportedLocale,
} from '$lib/services/integrations/media-libraries/stock/utils';
import { escapeAttr, escapeHTML } from '$lib/services/utils/string';

/**
 * @import {
 * ExternalAsset,
 * MediaLibraryFetchOptions,
 * MediaLibraryService,
 * } from '$lib/types/private';
 */

/**
 * @typedef {object} FetchResult
 * @property {string} id Asset ID.
 * @property {string} description Description.
 * @property {string} alt_description Alt description.
 * @property {{ regular: string, thumb: string }} urls Image URLs.
 * @property {{ username: string, name: string }} user User info.
 * @property {{ download_location?: string }} [links] Links, including the endpoint to request once
 * the photo is used.
 */

/**
 * @see https://unsplash.com/documentation#supported-languages
 */
const SUPPORTED_LOCALES = [
  'af,sq,am,ar,hy,as,az,bn,ba,eu,bs,bg,yue,ca,lzh,zh-Hans,zh-Hant,hr,cs,da,prs,dv,nl,en,et,fo,fj',
  'fil,fi,fr,fr-ca,gl,ka,de,el,gu,ht,he,hi,mww,hu,is,id,ikt,iu,iu-Latn,ga,it,ja,kn,kk,km,ko,ku,kmr',
  'ky,lo,lv,lt,mk,mg,ms,ml,mt,mi,mr,mn-Cyrl,mn-Mong,my,ne,nb,or,ps,fa,pl,pt,pt-pt,pa,otq,ro,ru,sm',
  'sr-Cyrl,sr-Latn,sk,sl,so,es,sw,sv,ty,ta,tt,te,th,bo,ti,to,tr,tk,uk,hsb,ur,ug,uz,vi,cy,yua,zu',
]
  .join(',')
  .split(',');

const ENDPOINT = 'https://api.unsplash.com';
const CREDIT_LINK_PARAMS = 'utm_source=sveltia-cms&utm_medium=referral';

/** @type {Record<string, any>} */
const SEARCH_PARAMS = {
  per_page: 30,
};

/**
 * Get the best matching locale supported by Unsplash API.
 * @returns {string} Locale code.
 */
export const getLocale = () => getSupportedLocale(SUPPORTED_LOCALES, 'en');

/**
 * Parse API results into ExternalAsset format.
 * @param {FetchResult[]} results API results.
 * @returns {ExternalAsset[]} Assets.
 */
export const parseResults = (results) =>
  results.map(
    ({
      id,
      description,
      alt_description: alt,
      urls: { regular, thumb },
      user: { username, name },
      links,
    }) => ({
      id: String(id),
      description: [description, alt].filter(Boolean).join(' — '),
      previewURL: thumb,
      downloadURL: regular,
      fileName: `${name.split(/\s+/).join('-').toLowerCase()}-${id}-unsplash.jpg`,
      kind: 'image',
      credit:
        `Photo by <a href="https://unsplash.com/@${escapeAttr(username)}?${CREDIT_LINK_PARAMS}">${escapeHTML(name)}</a> on ` +
        `<a href="https://unsplash.com/?${CREDIT_LINK_PARAMS}">Unsplash</a>`,
      downloadTrackingURL: links?.download_location,
    }),
  );

/**
 * Get the request headers for the given API key.
 * @param {string} apiKey API key.
 * @returns {Record<string, string>} Headers.
 */
const getHeaders = (apiKey) => ({ Authorization: `Client-ID ${apiKey}` });

/**
 * Fetch curated pictures, or search images.
 * @see https://unsplash.com/documentation
 * @todo Support video files.
 */
export const { list, search } = createStockFetchers({
  listURL: `${ENDPOINT}/photos`,
  searchURL: `${ENDPOINT}/search/photos`,
  getHeaders,
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
  getSearchParams: (query) => ({ ...SEARCH_PARAMS, query, lang: getLocale() }),
  searchKey: 'results',
  maxPages: 5,
  /**
   * Check whether another page of search results follows.
   * @param {{ total_pages: number }} response Response.
   * @param {number} page Page number.
   * @returns {boolean} Result.
   */
  hasMore: ({ total_pages: totalPages }, page) => page < totalPages,
  parseResults,
});

/**
 * Let Unsplash know a photo has been used, as its API guidelines require. A failure is only logged,
 * so it never gets in the way of the insertion.
 * @param {ExternalAsset} asset Inserted photo.
 * @param {MediaLibraryFetchOptions} options Options.
 * @returns {Promise<void>}
 * @see https://help.unsplash.com/en/articles/2511258-guideline-triggering-a-download
 */
export const trackDownload = async ({ downloadTrackingURL }, { apiKey }) => {
  if (!downloadTrackingURL) {
    return;
  }

  try {
    await fetchJSON(downloadTrackingURL, { headers: getHeaders(apiKey) });
  } catch (ex) {
    // eslint-disable-next-line no-console
    console.error(ex);
  }
};

/**
 * @type {MediaLibraryService}
 */
export default {
  serviceType: 'stock_assets',
  serviceId: 'unsplash',
  serviceLabel: 'Unsplash',
  serviceURL: 'https://unsplash.com/',
  showServiceLink: true,
  hotlinking: true,
  authType: 'api_key',
  developerURL: 'https://unsplash.com/developers',
  apiKeyURL: 'https://unsplash.com/oauth/applications',
  apiKeyPattern: /^[a-zA-Z\d_-]{40,}$/,
  list,
  search,
  trackDownload,
};
