import { getPathInfo } from '@sveltia/utils/file';
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
      sha,
      size,
      text = undefined,
      meta = {},
      folder: { internalPath },
    } = assetInfo;

    return /** @type {Asset} */ ({
      file,
      blobURL: undefined,
      path,
      name: getPathInfo(path).basename,
      sha,
      size,
      kind: getAssetKind(path),
      text,
      folder: internalPath,
      ...meta,
    });
  });
