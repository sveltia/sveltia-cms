/* eslint-disable no-await-in-loop */

import { sleep } from '@sveltia/utils/misc';
import { locale as appLocale } from 'svelte-i18n';
import { get } from 'svelte/store';

/**
 * @see https://www.pexels.com/api/documentation/#photos-search__parameters__locale
 */
const supportedLocales = [
  'en-US',
  'pt-BR',
  'es-ES',
  'ca-ES',
  'de-DE',
  'it-IT',
  'fr-FR',
  'sv-SE',
  'id-ID',
  'pl-PL',
  'ja-JP',
  'zh-TW',
  'zh-CN',
  'ko-KR',
  'th-TH',
  'nl-NL',
  'hu-HU',
  'vi-VN',
  'cs-CZ',
  'da-DK',
  'fi-FI',
  'uk-UA',
  'el-GR',
  'ro-RO',
  'nb-NO',
  'sk-SK',
  'tr-TR',
  'ru-RU',
];

const endpoint = 'https://api.pexels.com/v1';

/**
 * Search images or fetch curated pictures if no query is given.
 * @param {string} query - Search query.
 * @param {object} options - Options.
 * @param {string} options.apiKey - API key.
 * @returns {Promise<ExternalAsset[]>} Assets.
 * @see https://www.pexels.com/api/documentation/
 * @todo Support video files.
 */
const search = async (query, { apiKey }) => {
  const headers = { Authorization: apiKey };
  const [locale] = /** @type {string} */ (get(appLocale)).toLowerCase().split('-');
  /**
   * @type {{
   * id: number,
   * url: string,
   * alt: string,
   * src: { large2x: string, medium: string },
   * photographer: string
   * }[]}
   */
  let results = [];

  if (query) {
    for (let page = 1; page <= 2; page += 1) {
      const params = new URLSearchParams(
        /** @type {Record<string, any>} */ ({
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
      /** @type {Record<string, any>} */ ({
        per_page: 80,
      }),
    );

    const response = await fetch(`${endpoint}/curated?${params.toString()}`, { headers });

    if (!response.ok) {
      return Promise.reject();
    }

    results = (await response.json()).photos;
  }

  return results.map(({ id, url, alt, src: { large2x, medium }, photographer }) => ({
    id: String(id),
    description: url.match(/\/photo\/(?<alt>.+?)-\d+\/$/)?.groups?.alt.replace(/-/g, ' ') ?? alt,
    previewURL: medium,
    downloadURL: large2x,
    fileName: `pexels-${photographer.split(/\s+/).join('-').toLowerCase()}-${id}.jpg`,
    kind: 'image',
    credit: `<a href="${url}">Photo by ${photographer} on Pexels</a>`,
  }));
};

/**
 * @type {MediaLibraryService}
 */
export default {
  serviceType: 'stock_photos',
  serviceId: 'pexels',
  serviceLabel: 'Pexels',
  serviceURL: 'https://www.pexels.com/',
  showServiceLink: true,
  hotlinking: false,
  authType: 'api_key',
  developerURL: 'https://www.pexels.com/api/',
  apiKeyURL: 'https://www.pexels.com/api/new/',
  apiKeyPattern: /^[a-zA-Z\d]{56}$/,
  search,
};
