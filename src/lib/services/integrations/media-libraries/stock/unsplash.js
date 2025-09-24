/* eslint-disable no-await-in-loop */

import { sleep } from '@sveltia/utils/misc';
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
 * @property {string} id Asset ID.
 * @property {string} description Description.
 * @property {string} alt_description Alt description.
 * @property {{ regular: string, thumb: string }} urls Image URLs.
 * @property {{ username: string, name: string }} user User info.
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
export const getLocale = () => {
  const locale = /** @type {string} */ (get(appLocale)).toLowerCase();
  const [lang] = locale.split('-');

  return (
    SUPPORTED_LOCALES.find((code) => code.toLowerCase() === locale) ??
    SUPPORTED_LOCALES.find((code) => code.split('-')[0] === lang) ??
    'en'
  );
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
      description,
      alt_description: alt,
      urls: { regular, thumb },
      user: { username, name },
    }) => ({
      id: String(id),
      description: [description, alt].filter(Boolean).join(' — '),
      previewURL: thumb,
      downloadURL: regular,
      fileName: `${name.split(/\s+/).join('-').toLowerCase()}-${id}-unsplash.jpg`,
      kind: 'image',
      credit:
        `Photo by <a href="https://unsplash.com/@${username}?${CREDIT_LINK_PARAMS}">${name}</a> on ` +
        `<a href="https://unsplash.com/?${CREDIT_LINK_PARAMS}">Unsplash</a>`,
    }),
  );

/**
 * Fetch curated pictures.
 * @param {MediaLibraryFetchOptions} options Options.
 * @returns {Promise<ExternalAsset[]>} Assets.
 * @see https://unsplash.com/documentation
 * @todo Support video files.
 */
export const list = async ({ apiKey }) => {
  const headers = { Authorization: `Client-ID ${apiKey}` };
  const params = new URLSearchParams(SEARCH_PARAMS);
  const response = await fetch(`${ENDPOINT}/photos?${params}`, { headers });

  if (!response.ok) {
    return Promise.reject();
  }

  /** @type {FetchResult[]} */
  const results = await response.json();

  return parseResults(results);
};

/**
 * Search images or fetch curated pictures if no query is given.
 * @param {string} query Search query.
 * @param {MediaLibraryFetchOptions} options Options.
 * @returns {Promise<ExternalAsset[]>} Assets.
 * @see https://unsplash.com/documentation
 * @todo Support video files.
 */
export const search = async (query, { apiKey }) => {
  const headers = { Authorization: `Client-ID ${apiKey}` };
  const params = new URLSearchParams({ ...SEARCH_PARAMS, query, lang: getLocale() });
  /** @type {FetchResult[]} */
  const results = [];

  for (let page = 1; page <= 5; page += 1) {
    params.set('page', String(page));

    const response = await fetch(`${ENDPOINT}/search/photos?${params}`, { headers });

    if (!response.ok) {
      return Promise.reject();
    }

    const { results: pagedResults, total_pages: totalPages } = await response.json();

    results.push(...pagedResults);

    if (totalPages === page) {
      break;
    }

    // Wait for a bit before requesting the next page
    await sleep(50);
  }

  return parseResults(results);
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
  apiKeyPattern: /^[a-zA-Z\d-]{40,}$/,
  list,
  search,
};
