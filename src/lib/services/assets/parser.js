import { getPathInfo } from '@sveltia/utils/file';
import { getAssetKind } from '$lib/services/assets';

/**
 * Parse the given asset files to create a complete, serialized asset list.
 * @param {import('$lib/typedefs').BaseAssetListItem[]} assetFiles - Asset file list.
 * @returns {import('$lib/typedefs').Asset[]} Asset list.
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

    return /** @type {import('$lib/typedefs').Asset} */ ({
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
