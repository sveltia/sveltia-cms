import { getAssetKind } from '$lib/services/assets';

/**
 * Parse the given asset files to create a complete, serialized asset list.
 * @param {BaseAssetListItem[]} assetFiles - Asset file list.
 * @returns {Asset[]} Asset list.
 */
export const parseAssetFiles = (assetFiles) =>
  assetFiles.map((assetInfo) => {
    const {
      file,
      path,
      name = /** @type {string} */ (path.split('/').pop()),
      sha,
      size,
      text = undefined,
      meta = {},
      config: { collectionName, internalPath },
    } = assetInfo;

    return /** @type {Asset} */ ({
      file,
      blobURL: undefined,
      path,
      name,
      sha,
      size,
      kind: getAssetKind(name),
      text,
      collectionName,
      folder: internalPath,
      ...meta,
    });
  });
