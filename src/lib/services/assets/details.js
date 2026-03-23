import { get } from 'svelte/store';

import { getAssetBlobURL, getAssetPublicURL } from '$lib/services/assets/info';
import { backend } from '$lib/services/backends';
import { getEntriesByAssetURL } from '$lib/services/contents/collection/entries';
import { getMediaMetadata } from '$lib/services/utils/media';

/**
 * @import { Asset, AssetDetails, Entry } from '$lib/types/private';
 */

/** @type {AssetDetails} */
export const defaultAssetDetails = {
  publicURL: undefined,
  repoBlobURL: undefined,
  dimensions: undefined,
  duration: undefined,
  usedEntries: [],
};

/**
 * Get the given asset’s extra info.
 * @param {Asset} asset Asset.
 * @returns {Promise<Omit<AssetDetails, 'usedEntries'>>} Details. `usedEntries` is not included
 * because it can be expensive to fetch; use `getAssetUsedEntries` to fetch when needed.
 */
export const getAssetDetails = async (asset) => {
  const { kind, path } = asset;
  const { blobBaseURL } = get(backend)?.repository ?? {};
  const blobURL = await getAssetBlobURL(asset);
  let metaData = {};

  if (['image', 'video', 'audio'].includes(kind) && blobURL) {
    metaData = await getMediaMetadata(asset, blobURL, kind);
  }

  return {
    ...metaData,
    publicURL: getAssetPublicURL(asset),
    repoBlobURL: blobBaseURL ? `${blobBaseURL}/${path}` : undefined,
  };
};

/**
 * Get the list of entries using the given asset.
 * @param {Asset} asset Asset.
 * @returns {Promise<Entry[]>} List of entries using the asset.
 */
export const getAssetUsedEntries = async (asset) => {
  const url =
    getAssetPublicURL(asset, { allowSpecial: true, pathOnly: true }) ??
    (await getAssetBlobURL(asset));

  if (!url) {
    return [];
  }

  return getEntriesByAssetURL(url);
};
