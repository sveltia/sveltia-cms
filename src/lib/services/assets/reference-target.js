import { getAssetPublicURL } from '$lib/services/assets/info';

/**
 * @import { Asset } from '$lib/types/private';
 * @import { AssetReferenceTarget } from '$lib/services/assets/references';
 */

/**
 * Get what the references to the given asset are matched by: the public path of an asset that has
 * one, in the form it’s stored in a field value, or else the asset itself, as in an entry-relative
 * folder, where a value like `images/photo.jpg` refers to a different file in each entry’s folder,
 * so only a value resolving to the asset refers to it. The asset is matched without being loaded,
 * unlike by its blob URL.
 * @param {Asset} asset Asset.
 * @returns {AssetReferenceTarget} Target. The URL is not stripped of the site’s base URL, see
 * `getComparableAssetURL()`.
 */
export const getAssetReferenceTarget = (asset) => {
  const url = asset.folder.entryRelative
    ? undefined
    : getAssetPublicURL(asset, { allowSpecial: true, pathOnly: true });

  return url === undefined ? { asset } : { url };
};
