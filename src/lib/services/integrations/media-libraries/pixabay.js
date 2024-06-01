import { locale as appLocale } from 'svelte-i18n';
import { get } from 'svelte/store';

/**
 * @see https://pixabay.com/api/docs/#api_search_images
 */
const supportedLocales = [
  'cs',
  'da',
  'de',
  'en',
  'es',
  'fr',
  'id',
  'it',
  'hu',
  'nl',
  'no',
  'pl',
  'pt',
  'ro',
  'sk',
  'fi',
  'sv',
  'tr',
  'vi',
  'th',
  'bg',
  'ru',
  'el',
  'ja',
  'ko',
  'zh',
];

const endpoint = 'https://pixabay.com/api';

/**
 * Search images or fetch curated pictures if no query is given.
 * @param {string} query - Search query.
 * @param {object} options - Options.
 * @param {string} options.apiKey - API key.
 * @returns {Promise<ExternalAsset[]>} Assets.
 * @see https://pixabay.com/api/docs/
 * @todo Support video files.
 */
const search = async (query, { apiKey }) => {
  const [locale] = /** @type {string} */ (get(appLocale)).toLowerCase().split('-');

  const params = new URLSearchParams(
    /** @type {Record<string, any>} */ ({
      key: apiKey,
      q: query,
      lang: supportedLocales.includes(locale) ? locale : 'en',
      image_type: 'photo',
      min_width: 1280,
      editors_choice: !query,
      safesearch: true,
      per_page: 150,
    }),
  );

  const response = await fetch(`${endpoint}/?${params.toString()}`);

  if (!response.ok) {
    return Promise.reject();
  }

  /**
   * @type {{
   * id: number,
   * webformatURL: string,
   * previewURL: string,
   * largeImageURL: string,
   * imageWidth: number,
   * imageHeight: number,
   * pageURL: string,
   * tags: string,
   * user: string
   * }[]}
   */
  const results = (await response.json()).hits;

  return results.map(
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
};

/**
 * @type {MediaLibraryService}
 */
export default {
  serviceType: 'stock_photos',
  serviceId: 'pixabay',
  serviceLabel: 'Pixabay',
  serviceURL: 'https://pixabay.com/',
  showServiceLink: true,
  hotlinking: false,
  authType: 'api_key',
  developerURL: 'https://pixabay.com/service/about/api/',
  apiKeyURL: 'https://pixabay.com/api/docs/#api_key',
  apiKeyPattern: /^\d+-[a-f\d]{25}$/,
  search,
};
