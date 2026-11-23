import { getAssetsByDirName, getTakenNamesInDir } from '$lib/services/assets';
import { assetUpdatesToast, refreshFocusedAssets } from '$lib/services/assets/data';
import { formatFileName } from '$lib/services/assets/file-name';
import { getAssetKind } from '$lib/services/assets/kinds';
import { assertOutsideCmsFolders } from '$lib/services/assets/reserved';
import { getUploadDirPath } from '$lib/services/assets/subfolders';
import { isPublishingCommit } from '$lib/services/backends/git/shared/integration';
import { saveChanges } from '$lib/services/backends/save';
import { UPDATE_TOAST_DEFAULT_STATE } from '$lib/services/contents/collection/data';
import { getDefaultMediaLibraryOptions } from '$lib/services/integrations/media-libraries/default';
import { createPath, foldFileName } from '$lib/services/utils/file';

/**
 * @import {
 * Asset,
 * CommitAction,
 * CommitOptions,
 * FileChange,
 * UploadingAssets,
 * } from '$lib/types/private';
 */

/**
 * Create a list of file objects to be uploaded, ensuring that names are unique and sanitized. A
 * file that overwrites an existing asset — because the user picked that asset to be replaced, or
 * because they chose to overwrite a same-named file — takes over the asset’s name and path.
 * @param {UploadingAssets} uploadingAssets Assets to be uploaded.
 * @returns {{ action: CommitAction, name: string, path: string, file: File }[]} An array of objects
 * representing the files to be uploaded, each containing the action type, name, path, and file
 * object.
 */
export const createFileList = (uploadingAssets) => {
  const { files, originalAssets, replaceDuplicates = false } = uploadingAssets;
  const { slugify_filename: slugificationEnabled = false } = getDefaultMediaLibraryOptions().config;
  const dirPath = getUploadDirPath(uploadingAssets);
  const assetsInSameFolder = dirPath !== undefined ? getAssetsByDirName(dirPath) : [];
  // A file is never named after an entry file or a subfolder there either
  const assetNamesInSameFolder = dirPath !== undefined ? getTakenNamesInDir(dirPath) : [];
  // Folded names, so each file is checked against the folder without folding every name again
  const foldedNamesInSameFolder = new Set(assetNamesInSameFolder.map(foldFileName));
  /** @type {Map<string, Asset>} */
  const assetsByFoldedName = new Map();
  /** @type {Set<string>} */
  const namesInBatch = new Set();

  assetsInSameFolder.forEach((asset) => {
    const name = foldFileName(asset.name);

    if (!assetsByFoldedName.has(name)) {
      assetsByFoldedName.set(name, asset);
    }
  });

  return files.map((file, index) => {
    // The user picked this asset to be replaced, so the file takes over its name and path even
    // when it’s called something else. Failing that, an ordinary upload overwrites an existing
    // file of the same name when the user chose to replace it — but only the first of the files
    // with that name in the batch, e.g. two `photo.png` files from different subfolders of a
    // dropped folder; another one gets a name of its own, or it would overwrite the first one.
    const foldedFileName = foldFileName(file.name);

    const replacedAsset =
      originalAssets?.[index] ??
      (replaceDuplicates && !namesInBatch.has(foldedFileName)
        ? assetsByFoldedName.get(foldedFileName)
        : undefined);

    const fileName =
      replacedAsset?.name ??
      formatFileName(file.name, {
        slugificationEnabled,
        assetNamesInSameFolder,
        foldedNamesInSameFolder,
      });

    const foldedName = foldFileName(fileName);

    if (!foldedNamesInSameFolder.has(foldedName)) {
      assetNamesInSameFolder.push(fileName);
      foldedNamesInSameFolder.add(foldedName);
    }

    namesInBatch.add(foldedName);

    return {
      action: /** @type {CommitAction} */ (replacedAsset ? 'update' : 'create'),
      name: fileName,
      path: replacedAsset?.path ?? createPath([dirPath, fileName]),
      file,
    };
  });
};

/**
 * Update the asset stores with new assets, ensuring that focused and overlaid assets are refreshed,
 * and displays a toast notification about the asset updates.
 * @param {object} args Arguments.
 * @param {number} args.count The number of files that were updated.
 * @param {CommitOptions} args.options Options the files were committed with.
 */
export const updateStores = ({ count, options }) => {
  refreshFocusedAssets((asset) => asset.path);

  assetUpdatesToast.current = {
    ...UPDATE_TOAST_DEFAULT_STATE,
    saved: true,
    published: isPublishingCommit(options),
    count,
  };
};

/**
 * Prepare files to be saved to a repository folder, named as {@link createFileList} names them:
 * the assets they become and the changes that commit them.
 * @param {UploadingAssets} uploadingAssets Files to be saved.
 * @returns {{ savingAssets: Asset[], changes: FileChange[] }} Assets and changes, in the same
 * order as the files.
 * @throws {Error} When a file would be saved in a folder the CMS is served from.
 */
export const prepareAssetChanges = (uploadingAssets) => {
  const { folder } = uploadingAssets;
  const fileList = createFileList(uploadingAssets);

  assertOutsideCmsFolders(fileList.map(({ path }) => path));

  return {
    savingAssets: fileList.map(
      ({ name, path, file }) =>
        /** @type {Asset} */ ({ name, path, size: file.size, kind: getAssetKind(name), folder }),
    ),
    changes: fileList.map(({ action, path, file }) => ({ action, path, data: file })),
  };
};

/**
 * Upload/save the given assets to the backend.
 * @param {UploadingAssets} uploadingAssets Assets to be uploaded.
 * @param {CommitOptions} options Options for the backend handler.
 */
export const saveAssets = async (uploadingAssets, options) => {
  const { savingAssets, changes } = prepareAssetChanges(uploadingAssets);

  await saveChanges({ changes, savingAssets, options });

  updateStores({ count: uploadingAssets.files.length, options });
};
