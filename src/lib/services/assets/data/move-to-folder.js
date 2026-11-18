import { getTakenNamesInDir } from '$lib/services/assets';
import { moveAssets } from '$lib/services/assets/data/move';
import { getMovableAssets } from '$lib/services/assets/movable';
import { getAssetReferenceTarget } from '$lib/services/assets/reference-target';
import { getEntriesUsingTargets } from '$lib/services/assets/references';
import { createPath, foldFileName } from '$lib/services/utils/file';

/**
 * @import { Asset, AssetFolderInfo, Entry } from '$lib/types/private';
 */

/**
 * Get the entries using any of the given assets, each listed once, which a move updates.
 * @param {Asset[]} assets Assets.
 * @returns {Promise<Entry[]>} Entries.
 */
export const getAssetsUsedEntries = async (assets) =>
  getEntriesUsingTargets(assets.map(getAssetReferenceTarget));

/**
 * Get the names of the assets that can’t be moved to the given directory, because a file or folder
 * there already has the name, or another asset being moved along has it. A moved file would
 * overwrite another, and a Git tree can’t hold a file and a folder under one name.
 * @param {object} args Arguments.
 * @param {Asset[]} args.assets Assets to be moved.
 * @param {string} args.dirPath Destination directory path.
 * @returns {string[]} File names, in the order of the assets.
 */
export const getAssetMoveConflicts = ({ assets, dirPath }) => {
  // Case-insensitive, like an upload or a rename, since `Photo.jpg` and `photo.jpg` clash on a
  // case-insensitive file system like macOS’s or Windows’s, and Unicode-normalized
  const takenNames = new Set(getTakenNamesInDir(dirPath).map(foldFileName));
  /** @type {Set<string>} */
  const movingNames = new Set();
  /** @type {Set<string>} */
  const conflicts = new Set();

  getMovableAssets({ assets, dirPath }).forEach(({ name }) => {
    const foldedName = foldFileName(name);

    if (takenNames.has(foldedName) || movingNames.has(foldedName)) {
      conflicts.add(name);
    }

    movingNames.add(foldedName);
  });

  return [...conflicts];
};

/**
 * Move assets to a directory in another folder, or another directory of their own folder, while
 * updating the references to them in the entries, all in one commit. The assets already in the
 * directory are left where they are.
 * @param {object} args Arguments.
 * @param {Asset[]} args.assets Assets to be moved.
 * @param {AssetFolderInfo} args.folder Asset folder the directory belongs to.
 * @param {string} args.dirPath Destination directory path.
 * @throws {Error} When a file name is taken in the directory, an entry using the assets is
 * read-only, or the commit fails.
 */
export const moveAssetsToFolder = async ({ assets, folder, dirPath }) => {
  const conflicts = getAssetMoveConflicts({ assets, dirPath });

  if (conflicts.length) {
    throw new Error(`These files already exist in the folder: ${conflicts.join(', ')}`);
  }

  const movingAssets = getMovableAssets({ assets, dirPath }).map((asset) => ({
    asset,
    path: createPath([dirPath, asset.name]),
    folder,
  }));

  if (!movingAssets.length) {
    return;
  }

  await moveAssets('move', movingAssets);
};
