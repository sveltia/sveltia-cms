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

/**
 * Get the best matching locale supported by Pexels API.
 * @returns {string} Locale code.
 */
export const getLocale = () => {
  const locale = /** @type {string} */ (get(appLocale)).toLowerCase();
  const [lang] = locale.split('-');

  return (
    SUPPORTED_LOCALES.find((code) => code.toLowerCase() === locale) ??
    SUPPORTED_LOCALES.find((code) => code.split('-')[0] === lang) ??
    'en-US'
  );
};

/**
 * Parse API results into ExternalAsset format.
 * @param {FetchResult[]} results API results.
 * @returns {ExternalAsset[]} Assets.
 */
export const parseResults = (results) =>
  results.map(({ id, url, alt, src: { large2x, medium }, photographer }) => ({
    id: String(id),
    description: url.match(/\/photo\/(?<alt>.+?)-\d+\/$/)?.groups?.alt.replace(/-/g, ' ') ?? alt,
    previewURL: medium,
    downloadURL: large2x,
    fileName: `pexels-${photographer.split(/\s+/).join('-').toLowerCase()}-${id}.jpg`,
    kind: 'image',
    credit: `<a href="${url}">Photo by ${photographer} on Pexels</a>`,
  }));

/**
 * Fetch curated pictures.
 * @param {MediaLibraryFetchOptions} options Options.
 * @returns {Promise<ExternalAsset[]>} Assets.
 * @see https://www.pexels.com/api/documentation/
 * @todo Support video files.
 */
export const list = async ({ apiKey }) => {
  const headers = { Authorization: apiKey };
  const params = new URLSearchParams(SEARCH_PARAMS);
  const response = await fetch(`${ENDPOINT}/curated?${params}`, { headers });

  if (!response.ok) {
    return Promise.reject();
  }

  /** @type {FetchResult[]} */
  const results = (await response.json()).photos;

  return parseResults(results);
};

/**
 * Search images or fetch curated pictures if no query is given.
 * @param {string} query Search query.
 * @param {MediaLibraryFetchOptions} options Options.
 * @returns {Promise<ExternalAsset[]>} Assets.
 * @see https://www.pexels.com/api/documentation/
 * @todo Support video files.
 */
export const search = async (query, { apiKey }) => {
  const headers = { Authorization: apiKey };

  const params = new URLSearchParams({
    ...SEARCH_PARAMS,
    query,
    locale: getLocale(),
  });

  /** @type {FetchResult[]} */
  const results = [];

  for (let page = 1; page <= 2; page += 1) {
    params.set('page', String(page));

    const response = await fetch(`${ENDPOINT}/search?${params}`, { headers });

    if (!response.ok) {
      return Promise.reject();
    }

    const { photos: pagedResults, next_page: nextPage } = await response.json();

    results.push(...pagedResults);

    if (!nextPage) {
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
