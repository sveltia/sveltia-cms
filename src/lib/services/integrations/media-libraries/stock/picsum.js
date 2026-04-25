/**
 * @import {
 * ExternalAsset,
 * MediaLibraryService,
 * } from '$lib/types/private';
 */

/**
 * @typedef {object} FetchResult
 * @property {string} id Asset ID.
 * @property {number} width Image width.
 * @property {number} height Image height.
 */

const ENDPOINT = 'https://picsum.photos/v2/list';
const LIMIT = 100;
const TOTAL_PAGES = 10;
const FETCH_PAGES = 3;

/**
 * Parse API results into ExternalAsset format.
 * @param {FetchResult[]} results API results.
 * @returns {ExternalAsset[]} Assets.
 */
export const parseResults = (results) =>
  results.map(({ id, width, height }) => {
    // Limit the maximum dimension to 1920px to avoid excessively large files, while maintaining the
    // aspect ratio. 1920x1280 is a common resolution that provides good quality without being too
    // large for most use cases.
    const landscape = width >= height;
    const [w, h] = landscape ? [1920, 1280] : [1280, 1920];
    const [pw, ph] = landscape ? [480, 320] : [320, 480];

    return {
      id,
      // The service doesn’t provide descriptions
      description: '',
      previewURL: `https://picsum.photos/id/${id}/${pw}/${ph}.webp`,
      downloadURL: `https://picsum.photos/id/${id}/${w}/${h}.webp`,
      fileName: `picsum-${id}.webp`,
      kind: 'image',
      // No credit is required as the photos are licensed under CC0
      // https://github.com/DMarby/picsum-photos/issues/81#issuecomment-1340068800
    };
  });

/**
 * Fetch all available pictures across all pages.
 * @returns {Promise<ExternalAsset[]>} Assets.
 * @see https://picsum.photos/#list-images
 */
export const list = async () => {
  // Pick random pages from the 10 available (100 images each).
  const pages = Array.from({ length: TOTAL_PAGES }, (_, i) => i + 1)
    .sort(() => Math.random() - 0.5)
    .slice(0, FETCH_PAGES);

  const responses = await Promise.all(
    pages.map((page) => fetch(`${ENDPOINT}?page=${page}&limit=${LIMIT}`)),
  );

  if (responses.some((r) => !r.ok)) {
    return Promise.reject();
  }

  /** @type {FetchResult[][]} */
  const pageResults = await Promise.all(responses.map((r) => r.json()));

  // Randomize the results for variety, as the API returns them in the same order for the same page.
  return parseResults(pageResults.flat().sort(() => Math.random() - 0.5));
};

/**
 * @type {MediaLibraryService}
 */
export default {
  serviceType: 'stock_assets',
  serviceId: 'picsum',
  serviceLabel: 'Lorem Picsum',
  serviceURL: 'https://picsum.photos/',
  showServiceLink: true,
  hotlinking: true,
  authType: 'none',
  list,
};
