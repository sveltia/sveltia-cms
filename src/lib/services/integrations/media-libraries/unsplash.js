/* eslint-disable no-await-in-loop */

import { sleep } from '@sveltia/utils/misc';
import { locale as appLocale } from 'svelte-i18n';
import { get } from 'svelte/store';

/**
 * @see https://unsplash.com/documentation#supported-languages
 */
const supportedLocales = [
  'af',
  'sq',
  'am',
  'ar',
  'hy',
  'as',
  'az',
  'bn',
  'ba',
  'eu',
  'bs',
  'bg',
  'yue',
  'ca',
  'lzh',
  'zh-Hans',
  'zh-Hant',
  'hr',
  'cs',
  'da',
  'prs',
  'dv',
  'nl',
  'en',
  'et',
  'fo',
  'fj',
  'fil',
  'fi',
  'fr',
  'fr-ca',
  'gl',
  'ka',
  'de',
  'el',
  'gu',
  'ht',
  'he',
  'hi',
  'mww',
  'hu',
  'is',
  'id',
  'ikt',
  'iu',
  'iu-Latn',
  'ga',
  'it',
  'ja',
  'kn',
  'kk',
  'km',
  'ko',
  'ku',
  'kmr',
  'ky',
  'lo',
  'lv',
  'lt',
  'mk',
  'mg',
  'ms',
  'ml',
  'mt',
  'mi',
  'mr',
  'mn-Cyrl',
  'mn-Mong',
  'my',
  'ne',
  'nb',
  'or',
  'ps',
  'fa',
  'pl',
  'pt',
  'pt-pt',
  'pa',
  'otq',
  'ro',
  'ru',
  'sm',
  'sr-Cyrl',
  'sr-Latn',
  'sk',
  'sl',
  'so',
  'es',
  'sw',
  'sv',
  'ty',
  'ta',
  'tt',
  'te',
  'th',
  'bo',
  'ti',
  'to',
  'tr',
  'tk',
  'uk',
  'hsb',
  'ur',
  'ug',
  'uz',
  'vi',
  'cy',
  'yua',
  'zu',
];

const endpoint = 'https://api.unsplash.com';
const creditLinkParams = 'utm_source=sveltia-cms&utm_medium=referral';

/**
 * Search images or fetch curated pictures if no query is given.
 * @param {string} query - Search query.
 * @param {object} options - Options.
 * @param {string} options.apiKey - API key.
 * @returns {Promise<ExternalAsset[]>} Assets.
 * @see https://unsplash.com/documentation
 * @todo Support video files.
 */
const search = async (query, { apiKey }) => {
  const headers = { Authorization: `Client-ID ${apiKey}` };
  const [locale] = /** @type {string} */ (get(appLocale)).toLowerCase().split('-');
  /**
   * @type {{
   * id: string,
   * description: string,
   * alt_description: string,
   * urls: { regular: string, thumb: string },
   * user: { username: string, name: string }
   * }[]}}
   */
  let results = [];

  if (query) {
    for (let page = 1; page <= 5; page += 1) {
      const params = new URLSearchParams(
        /** @type {Record<string, any>} */ ({
          query,
          lang: supportedLocales.includes(locale) ? locale : 'en',
          page,
          per_page: 30,
        }),
      );

      const response = await fetch(`${endpoint}/search/photos?${params.toString()}`, { headers });

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
  } else {
    const params = new URLSearchParams(
      /** @type {Record<string, any>} */ ({
        per_page: 30,
      }),
    );

    const response = await fetch(`${endpoint}/photos?${params.toString()}`, { headers });

    if (!response.ok) {
      return Promise.reject();
    }

    results = await response.json();
  }

  return results.map(
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
        `Photo by <a href="https://unsplash.com/@${username}?${creditLinkParams}">${name}</a> on ` +
        `<a href="https://unsplash.com/?${creditLinkParams}">Unsplash</a>`,
    }),
  );
};

/**
 * @type {MediaLibraryService}
 */
export default {
  serviceType: 'stock_photos',
  serviceId: 'unsplash',
  serviceLabel: 'Unsplash',
  serviceURL: 'https://unsplash.com/',
  showServiceLink: true,
  hotlinking: true,
  authType: 'api_key',
  developerURL: 'https://unsplash.com/developers',
  apiKeyURL: 'https://unsplash.com/oauth/applications',
  apiKeyPattern: /^[a-zA-Z\d-]{40,}$/,
  search,
};
