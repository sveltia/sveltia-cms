/* eslint-disable no-await-in-loop */

import { locale as appLocale } from 'svelte-i18n';
import { get } from 'svelte/store';
import { sleep } from '$lib/services/utils/misc';

const serviceId = 'pexels';
const serviceLabel = 'Pexels';
const hotlinking = false;
const landingURL = 'https://www.pexels.com/api/';
const apiKeyURL = 'https://www.pexels.com/api/new/';
const apiKeyPattern = /^[a-zA-Z\d]{56}$/;

const supportedLocales = [
  'en-US,pt-BR,es-ES,ca-ES,de-DE,it-IT,fr-FR,sv-SE,id-ID,pl-PL,ja-JP,zh-TW,zh-CN,ko-KR,th-TH,nl-NL',
  'hu-HU,vi-VN,cs-CZ,da-DK,fi-FI,uk-UA,el-GR,ro-RO,nb-NO,sk-SK,tr-TR,ru-RU',
]
  .join(',')
  .split(',');

const endpoint = 'https://api.pexels.com/v1';

/**
 * Search images or fetch curated pictures if no query is given.
 * @param {string} query Search query
 * @param {string} apiKey API key.
 * @returns {Promise<StockPhoto[]>} Photos.
 * @see https://www.pexels.com/api/documentation/
 */
const searchImages = async (query, apiKey) => {
  const headers = { Authorization: apiKey };
  const [locale] = get(appLocale).toLowerCase().split('-');
  let results = [];

  if (query) {
    for (let page = 1; page <= 2; page += 1) {
      const params = new URLSearchParams(
        /** @type {any} */ ({
          query,
          locale: supportedLocales.find((code) => code.split('-')[0] === locale) || 'en-US',
          page,
          per_page: 80,
        }),
      );

      const response = await fetch(`${endpoint}/search?${params.toString()}`, { headers });

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
  } else {
    const params = new URLSearchParams(
      /** @type {any} */ ({
        per_page: 80,
      }),
    );

    const response = await fetch(`${endpoint}/curated?${params.toString()}`, { headers });

    if (!response.ok) {
      return Promise.reject();
    }

    results = (await response.json()).photos;
  }

  return results.map(({ id, url, alt, src: { large2x, tiny }, photographer }) => ({
    id: String(id),
    description: alt,
    previewURL: tiny,
    downloadURL: large2x,
    fileName: `pexels-${photographer.split(/\s+/).join('-').toLowerCase()}-${id}.jpg`,
    credit: `<a href="${url}">Photo by ${photographer} on Pexels</a>`,
  }));
};

/**
 * @type {PictureService}
 */
export default {
  serviceId,
  serviceLabel,
  hotlinking,
  landingURL,
  apiKeyURL,
  apiKeyPattern,
  searchImages,
};
