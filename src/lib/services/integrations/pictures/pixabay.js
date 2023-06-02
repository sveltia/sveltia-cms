import { locale as appLocale } from 'svelte-i18n';
import { get } from 'svelte/store';

const serviceId = 'pixabay';
const serviceLabel = 'Pixabay';
const hotlinking = false;
const landingURL = 'https://pixabay.com/service/about/api/';
const apiKeyURL = 'https://pixabay.com/api/docs/#api_key';
const apiKeyPattern = /^\d+-[a-f\d]{25}$/;

const supportedLocales =
  'cs,da,de,en,es,fr,id,it,hu,nl,no,pl,pt,ro,sk,fi,sv,tr,vi,th,bg,ru,el,ja,ko,zh'.split(',');

const endpoint = 'https://pixabay.com/api';

/**
 * Search images or fetch curated pictures if no query is given.
 * @param {string} query Search query
 * @param {string} apiKey API key.
 * @returns {Promise<StockPhoto[]>} Photos.
 * @see https://pixabay.com/api/docs/
 */
const searchImages = async (query, apiKey) => {
  const [locale] = get(appLocale).toLowerCase().split('-');

  const params = new URLSearchParams(
    /** @type {any} */ ({
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

  return (await response.json()).hits.map(
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
      fileName: previewURL.split('/').pop().replace('_150.', '_1280.'),
      credit: `<a href="${pageURL}">Photo by ${user} on Pixabay`,
    }),
  );
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
