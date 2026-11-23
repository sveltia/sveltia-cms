import { getAssetPublicURL } from '$lib/services/assets/info';

/**
 * @import { Asset } from '$lib/types/private';
 * @import { AssetReferenceTarget } from '$lib/services/assets/references';
 */

/**
 * Get what the references to the given asset are matched by: the public path of an asset that has
 * one, in the form it’s stored in a field value, or else the asset itself, as in an entry-relative
 * folder, where a value like `images/photo.jpg` refers to a different file in each entry’s folder,
 * so only a value resolving to the asset refers to it. The same goes for a relative public path, as
 * with an empty `public_folder`, which stores a bare path relative to the media folder, e.g.
 * `photo.jpg`, or one starting with `.`: another collection’s media folder can hold a different
 * file stored as the same value. A path starting with `/` or `@`, or a URL, refers to one file
 * only. The asset is matched without being loaded, unlike by its blob URL.
 * @param {Asset} asset Asset.
 * @returns {AssetReferenceTarget} Target. The URL is not stripped of the site’s base URL, see
 * `getComparableAssetURL()`.
 */
export const getAssetReferenceTarget = (asset) => {
  const url = asset.folder.entryRelative
    ? undefined
    : getAssetPublicURL(asset, { allowSpecial: true, pathOnly: true });

  return url === undefined || !/^(?:[/@]|[a-z][\d+.a-z-]*:\/\/)/i.test(url) ? { asset } : { url };
};
