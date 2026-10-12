import { getAssetBlobURL, getAssetPublicURL } from '$lib/services/assets/info';
import { isMediaKind } from '$lib/services/assets/kinds';
import { getEntriesByAssets, getEntriesByAssetURL } from '$lib/services/assets/references';
import { backend } from '$lib/services/backends';
import { getOrCreateAsync } from '$lib/services/utils/cache';
import { getMediaMetadata } from '$lib/services/utils/media';
import { encodePathSegments } from '$lib/services/utils/url';

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

  if (!isMediaKind(kind)) {
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

  return getOrCreateAsync(cachedMetadata, sha, () => collectMediaMetadata(asset));
};

/**
 * Get the given asset’s extra info.
 * @param {Asset} asset Asset.
 * @returns {Promise<Omit<AssetDetails, 'usedEntries'>>} Details. `usedEntries` is not included
 * because it can be expensive to fetch; use `getAssetUsedEntries` to fetch when needed.
 */
export const getAssetDetails = async (asset) => {
  const { path } = asset;
  const { blobBaseURL } = backend.current?.repository ?? {};
  const metaData = await getMediaMetadataOnce(asset);

  // The URLs are derived from the asset’s path and the current config rather than its content, so
  // they’re resolved per call instead of being cached with the metadata
  return {
    ...metaData,
    publicURL: getAssetPublicURL(asset),
    // Encode the path, as a file name can contain `#`, `?` or `%`, which would break the URL
    repoBlobURL: blobBaseURL ? `${blobBaseURL}/${encodePathSegments(path)}` : undefined,
  };
};

/**
 * Get the list of entries using the given asset. An asset is matched by its public path, in the
 * form it’s stored in a field value, or else by the asset itself, as in an entry-relative folder,
 * where a value like `images/photo.jpg` refers to a different file in each entry’s folder, so only
 * a value resolving to the asset refers to it.
 * @param {Asset} asset Asset.
 * @returns {Promise<Entry[]>} List of entries using the asset.
 */
export const getAssetUsedEntries = async (asset) => {
  const url = asset.folder.entryRelative
    ? undefined
    : getAssetPublicURL(asset, { allowSpecial: true, pathOnly: true });

  if (url) {
    return getEntriesByAssetURL(url);
  }

  const [entries] = await getEntriesByAssets([{ asset }]);

  return entries;
};
