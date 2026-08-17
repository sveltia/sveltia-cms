import { get } from 'svelte/store';

import { getAssetBlobURL, getAssetPublicURL } from '$lib/services/assets/info';
import { backend } from '$lib/services/backends';
import { getEntriesByAssetURL } from '$lib/services/contents/collection/entries';
import { getMediaMetadata } from '$lib/services/utils/media';

/**
 * @import { Asset, AssetDetails, Entry } from '$lib/types/private';
 */

/**
 * The part of {@link AssetDetails} that comes from the file itself.
 * @typedef {Pick<AssetDetails, 'dimensions' | 'duration' | 'createdDate' | 'coordinates'>}
 * MediaMetadata
 */

/**
 * Media metadata for the assets looked at so far, keyed by asset SHA. Collecting it downloads the
 * file, decodes it to read its dimensions and scans it for Exif data, and the result depends on
 * nothing but the file’s content, so it’s gathered once per file rather than once per component
 * asking for it — the info panel and the toolbar both ask as soon as an asset is selected.
 * @type {Map<string, Promise<MediaMetadata>>}
 */
const cachedMetadata = new Map();

/* v8 ignore next */
/**
 * Reset the media metadata cache. This is used in tests to reset the state between tests.
 * @internal
 */
export const _resetAssetMetadataCache = () => {
  cachedMetadata.clear();
};

/** @type {AssetDetails} */
export const defaultAssetDetails = {
  publicURL: undefined,
  repoBlobURL: undefined,
  dimensions: undefined,
  duration: undefined,
  usedEntries: [],
};

/**
 * Collect the media metadata of the given asset, if it’s a kind that has any.
 * @param {Asset} asset Asset.
 * @returns {Promise<MediaMetadata>} Metadata, or an empty object for a file with no media info.
 */
const collectMediaMetadata = async (asset) => {
  const { kind } = asset;

  if (!['image', 'video', 'audio'].includes(kind)) {
    return {};
  }

  const blobURL = await getAssetBlobURL(asset);

  return blobURL ? getMediaMetadata(asset, blobURL, kind) : {};
};

/**
 * Get the media metadata of the given asset, reusing what was collected for the same file before.
 * A failed attempt isn’t remembered, so a later caller can try again.
 * @param {Asset} asset Asset.
 * @returns {Promise<MediaMetadata>} Metadata.
 */
const getMediaMetadataOnce = (asset) => {
  const { sha } = asset;

  if (!sha) {
    return collectMediaMetadata(asset);
  }

  let pending = cachedMetadata.get(sha);

  if (!pending) {
    pending = collectMediaMetadata(asset).catch((ex) => {
      cachedMetadata.delete(sha);

      throw ex;
    });

    cachedMetadata.set(sha, pending);
  }

  return pending;
};

/**
 * Get the given asset’s extra info.
 * @param {Asset} asset Asset.
 * @returns {Promise<Omit<AssetDetails, 'usedEntries'>>} Details. `usedEntries` is not included
 * because it can be expensive to fetch; use `getAssetUsedEntries` to fetch when needed.
 */
export const getAssetDetails = async (asset) => {
  const { path } = asset;
  const { blobBaseURL } = get(backend)?.repository ?? {};
  const metaData = await getMediaMetadataOnce(asset);

  // The URLs are derived from the asset’s path and the current config rather than its content, so
  // they’re resolved per call instead of being cached with the metadata
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
