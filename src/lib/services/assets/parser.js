import { getAssetKind } from '$lib/services/assets';

/**
 * @import { Asset, BaseAssetListItem } from '$lib/types/private';
 */

/**
 * Parse the given asset files to create a complete, serialized asset list.
 * @param {BaseAssetListItem[]} assetFiles Asset file list.
 * @returns {Asset[]} Asset list.
 */
export const parseAssetFiles = (assetFiles) =>
  assetFiles.map((assetInfo) => {
    const { file, path, name, sha, size, text = undefined, meta = {}, folder } = assetInfo;

    return /** @type {Asset} */ ({
      file,
      blobURL: undefined,
      path,
      name,
      sha,
      size,
      kind: getAssetKind(path),
      text,
      folder,
      ...meta,
    });
  });
