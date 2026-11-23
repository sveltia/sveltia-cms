/**
 * @import {
 * ExternalAsset,
 * MediaLibraryFetchOptions,
 * MediaLibraryService,
 * } from '$lib/types/private';
 */

/**
 * Assets of an external media library, as listed in the Select Assets dialog.
 * @typedef {object} ExternalAssetListing
 * @property {ExternalAsset[]} assets Assets.
 * @property {string[]} [folders] Paths of the empty folders, if the service lists its folders.
 * @property {boolean} truncated Whether the listing stopped short of the end.
 */

/**
 * Search or list the assets of an external media library: search with the given query, browse the
 * folders of a service that stores its files at paths, along with its empty folders, or list the
 * files, which for a stock asset service are the popular or curated ones.
 * @param {object} args Arguments.
 * @param {Pick<MediaLibraryService, 'search' | 'browse' | 'list'>} args.service Service.
 * @param {string} args.query Search query, which is only given to a service that can search.
 * @param {MediaLibraryFetchOptions} args.options Fetch options.
 * @returns {Promise<ExternalAssetListing>} Listing.
 */
export const fetchExternalAssetListing = async ({
  service: { search, browse, list },
  query,
  options,
}) => {
  if (query && search) {
    return { assets: await search(query, options), truncated: false };
  }

  if (browse) {
    const { assets, folders, truncated = false } = await browse(options);

    return { assets, folders, truncated };
  }

  return { assets: (await list?.(options)) ?? [], truncated: false };
};
