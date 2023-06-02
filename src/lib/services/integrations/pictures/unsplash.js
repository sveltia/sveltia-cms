/* eslint-disable no-await-in-loop */

import { locale as appLocale } from 'svelte-i18n';
import { get } from 'svelte/store';
import { sleep } from '$lib/services/utils/misc';

const serviceId = 'unsplash';
const serviceLabel = 'Unsplash';
const hotlinking = true;
const landingURL = 'https://unsplash.com/developers';
const apiKeyURL = 'https://unsplash.com/oauth/applications';
const apiKeyPattern = /^[a-zA-Z\d-]{40,}$/;

const supportedLocales = [
  'af,am,ar,az,be,bg,bn,bs,ca,ceb,co,cs,cy,da,de,el,en,eo,es,et,eu,fa,fi,fr,fy,ga,gd,gl,gu,ha,haw',
  'hi,hmn,hr,ht,hu,hy,id,ig,is,it,iw,ja,jw,ka,kk,km,kn,ko,ku,ky,la,lb,lo,lt,lv,mg,mi,mk,ml,mn,mr',
  'ms,mt,my,ne,nl,no,ny,or,pa,pl,ps,pt,ro,ru,rw,sd,si,sk,sl,sm,sn,so,sq,sr,st,su,sv,sw,ta,te,tg,th',
  'tk,tl,tr,tt,ug,uk,ur,uz,vi,xh,yi,yo,zh,zh-TW,zu',
]
  .join(',')
  .split(',');

const endpoint = 'https://api.unsplash.com';
const creditLinkParams = 'utm_source=sveltia-cms&utm_medium=referral';

/**
 * Search images or fetch curated pictures if no query is given.
 * @param {string} query Search query
 * @param {string} apiKey API key.
 * @returns {Promise<StockPhoto[]>} Photos.
 * @see https://unsplash.com/documentation
 */
const searchImages = async (query, apiKey) => {
  const headers = { Authorization: `Client-ID ${apiKey}` };
  const [locale] = get(appLocale).toLowerCase().split('-');
  let results = [];

  if (query) {
    for (let page = 1; page <= 5; page += 1) {
      const params = new URLSearchParams(
        /** @type {any} */ ({
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
      /** @type {any} */ ({
        per_page: 30,
      }),
    );

    const response = await fetch(`${endpoint}/photos?${params.toString()}`, { headers });

    if (!response.ok) {
      return Promise.reject();
    }

    results = await response.json();
  }

  return results.map(({ id, description, urls: { regular, thumb }, user: { username, name } }) => ({
    id: String(id),
    description,
    previewURL: thumb,
    downloadURL: regular,
    fileName: `${name.split(/\s+/).join('-').toLowerCase()}-${id}-unsplash.jpg`,
    credit:
      `Photo by <a href="https://unsplash.com/@${username}?${creditLinkParams}">${name}</a> on ` +
      `<a href="https://unsplash.com/?${creditLinkParams}">Unsplash</a>`,
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
