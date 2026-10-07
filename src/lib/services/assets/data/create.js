import { getAssetsByDirName } from '$lib/services/assets';
import { assetUpdatesToast, refreshFocusedAssets } from '$lib/services/assets/data';
import { formatFileName } from '$lib/services/assets/file-name';
import { getAssetKind } from '$lib/services/assets/kinds';
import { assertOutsideCmsFolders } from '$lib/services/assets/reserved';
import { getUploadDirPath } from '$lib/services/assets/subfolders';
import { skipCIConfigured, skipCIEnabled } from '$lib/services/backends/git/shared/integration';
import { saveChanges } from '$lib/services/backends/save';
import { UPDATE_TOAST_DEFAULT_STATE } from '$lib/services/contents/collection/data';
import { getDefaultMediaLibraryOptions } from '$lib/services/integrations/media-libraries/default';
import { createPath } from '$lib/services/utils/file';

/**
 * @import { Asset, CommitAction, CommitOptions, UploadingAssets } from '$lib/types/private';
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
  const assetNamesInSameFolder = assetsInSameFolder.map((a) => a.name.normalize());

  return files.map((file, index) => {
    // The user picked this asset to be replaced, so the file takes over its name and path even
    // when it’s called something else. Failing that, an ordinary upload overwrites an existing
    // file of the same name when the user chose to replace it.
    const replacedAsset =
      originalAssets?.[index] ??
      (replaceDuplicates
        ? assetsInSameFolder.find(
            (a) => a.name.normalize().toLowerCase() === file.name.normalize().toLowerCase(),
          )
        : undefined);

    const fileName =
      replacedAsset?.name ??
      formatFileName(file.name, { slugificationEnabled, assetNamesInSameFolder });

    if (!assetNamesInSameFolder.includes(fileName)) {
      assetNamesInSameFolder.push(fileName);
    }

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
 */
export const updateStores = ({ count }) => {
  refreshFocusedAssets((asset) => asset.path);

  assetUpdatesToast.current = {
    ...UPDATE_TOAST_DEFAULT_STATE,
    saved: true,
    published: skipCIConfigured.current && !skipCIEnabled.current,
    count,
  };
};

/**
 * Upload/save the given assets to the backend.
 * @param {UploadingAssets} uploadingAssets Assets to be uploaded.
 * @param {CommitOptions} options Options for the backend handler.
 */
export const saveAssets = async (uploadingAssets, options) => {
  const { files, folder } = uploadingAssets;
  const savingFileList = createFileList(uploadingAssets);

  assertOutsideCmsFolders(savingFileList.map(({ path }) => path));

  const savingAssets = savingFileList.map(
    ({ name, path, file }) =>
      /** @type {Asset} */ ({
        name,
        path,
        size: file.size,
        kind: getAssetKind(name),
        folder,
      }),
  );

  await saveChanges({
    changes: savingFileList.map(({ action, path, file }) => ({ action, path, data: file })),
    savingAssets,
    options,
  });

  updateStores({ count: files.length });
};
