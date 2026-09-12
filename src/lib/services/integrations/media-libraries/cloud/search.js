/**
 * @import { ExternalAsset } from '$lib/types/private';
 */

/**
 * Filter assets by a search query on the client side, for a storage service that doesn’t offer a
 * search API. An asset matches when its file name or description contains the query,
 * case-insensitively.
 * @param {ExternalAsset[]} assets Assets to filter.
 * @param {string} query Search query.
 * @returns {ExternalAsset[]} Matching assets.
 */
export const filterAssetsByQuery = (assets, query) => {
  const lowerQuery = query.toLowerCase();

  return assets.filter(
    ({ fileName, description }) =>
      fileName.toLowerCase().includes(lowerQuery) || description.toLowerCase().includes(lowerQuery),
  );
};
