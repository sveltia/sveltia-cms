import { getAssetBlob } from '$lib/services/assets/info';
import { readBlobAsFile } from '$lib/services/utils/file';

/**
 * @import { Asset, FileChange } from '$lib/types/private';
 */

/**
 * Create the file change that moves the given asset to another path.
 * @param {Asset} asset Asset to move.
 * @param {string} path New path.
 * @param {string} [name] File name at the new path. Default: the asset’s current name.
 * @returns {Promise<FileChange>} Change.
 */
export const createAssetMoveChange = async (asset, path, name = asset.name) => {
  const blob = asset.file ?? (await getAssetBlob(asset));

  return {
    action: 'move',
    path,
    previousPath: asset.path,
    previousSha: asset.sha,
    // The file about to be moved away can’t be read afterwards, to write the copy or to hash it
    data: await readBlobAsFile(blob, name),
  };
};
