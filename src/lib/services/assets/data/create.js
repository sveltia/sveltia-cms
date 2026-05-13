import { get } from 'svelte/store';

import {
  focusedAsset,
  getAssetByInternalPath,
  getAssetsByDirName,
  overlaidAsset,
} from '$lib/services/assets';
import { assetUpdatesToast } from '$lib/services/assets/data';
import { getAssetKind } from '$lib/services/assets/kinds';
import { skipCIConfigured, skipCIEnabled } from '$lib/services/backends/git/shared/integration';
import { saveChanges } from '$lib/services/backends/save';
import { UPDATE_TOAST_DEFAULT_STATE } from '$lib/services/contents/collection/data';
import { getDefaultMediaLibraryOptions } from '$lib/services/integrations/media-libraries/default';
import { formatFileName } from '$lib/services/utils/file';

/**
 * @import { Asset, AssetFolderInfo } from '$lib/types/private';
 * @import { CommitAction, CommitOptions, UploadingAssets } from '$lib/types/private';
 */

/**
 * Create a list of file objects to be uploaded, ensuring that names are unique and sanitized.
 * @internal
 * @param {UploadingAssets} uploadingAssets Assets to be uploaded.
 * @returns {{ action: CommitAction, name: string, path: string, file: File }[]} An array of objects
 * representing the files to be uploaded, each containing the action type, name, path, and file
 * object.
 */
export const createFileList = (uploadingAssets) => {
  const { files, folder, originalAsset, subPath } = uploadingAssets;
  const { slugify_filename: slugificationEnabled = false } = getDefaultMediaLibraryOptions().config;

  const targetDir =
    subPath && folder?.internalPath
      ? [folder.internalPath, subPath].join('/')
      : folder?.internalPath;

  const assetNamesInSameFolder =
    targetDir !== undefined ? getAssetsByDirName(targetDir).map((a) => a.name.normalize()) : [];

  return files.map((file) => {
    const fileName =
      originalAsset?.name ??
      formatFileName(file.name, { slugificationEnabled, assetNamesInSameFolder });

    if (!assetNamesInSameFolder.includes(fileName)) {
      assetNamesInSameFolder.push(fileName);
    }

    let filePath;

    if (originalAsset?.path) {
      filePath = originalAsset.path;
    } else if (subPath && folder?.internalPath) {
      filePath = [folder.internalPath, subPath, fileName].join('/');
    } else if (targetDir) {
      filePath = [targetDir, fileName].join('/');
    } else {
      filePath = fileName;
    }

    return {
      action: /** @type {CommitAction} */ (originalAsset ? 'update' : 'create'),
      name: fileName,
      path: filePath,
      file,
    };
  });
};

/**
 * Update the asset stores with new assets, ensuring that focused and overlaid assets are refreshed,
 * and displays a toast notification about the asset updates.
 * @internal
 * @param {object} args Arguments.
 * @param {number} args.count The number of files that were updated.
 */
export const updatedStores = ({ count }) => {
  const _focusedAsset = get(focusedAsset);
  const _overlaidAsset = get(overlaidAsset);

  // Replace the existing asset
  if (_focusedAsset) {
    focusedAsset.set(getAssetByInternalPath(_focusedAsset.path));
  }

  // Replace the existing asset
  if (_overlaidAsset) {
    overlaidAsset.set(getAssetByInternalPath(_overlaidAsset.path));
  }

  assetUpdatesToast.set({
    ...UPDATE_TOAST_DEFAULT_STATE,
    saved: true,
    published: get(skipCIConfigured) && !get(skipCIEnabled),
    count,
  });
};

/**
 * Upload/save the given assets to the backend.
 * @param {UploadingAssets} uploadingAssets Assets to be uploaded.
 * @param {CommitOptions} options Options for the backend handler.
 */
export const saveAssets = async (uploadingAssets, options) => {
  const { files, folder } = uploadingAssets;
  const savingFileList = createFileList(uploadingAssets);

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

  updatedStores({ count: files.length });
};

/**
 * Create a new empty folder by committing a `.gitkeep` file inside it.
 * @param {string} name Folder name.
 * @param {AssetFolderInfo | undefined} parentFolder The parent asset folder.
 * @param {string} [currentSubPath] Current sub-path within the parent folder.
 */
export const createFolder = async (name, parentFolder, currentSubPath) => {
  const basePath = parentFolder?.internalPath ?? '';

  if (!basePath) {
    throw new Error('Cannot create folder: no parent folder selected');
  }

  const folderPath = currentSubPath
    ? `${basePath}/${currentSubPath}/${name}`
    : `${basePath}/${name}`;

  /** @type {Asset} */
  const asset = {
    name: '.gitkeep',
    path: `${folderPath}/.gitkeep`,
    sha: '',
    size: 0,
    kind: 'other',
    folder: /** @type {AssetFolderInfo} */ (parentFolder),
  };

  await saveChanges({
    changes: [
      { action: 'create', path: `${folderPath}/.gitkeep`, data: new File([''], '.gitkeep') },
    ],
    savingAssets: [asset],
    options: { commitType: 'uploadMedia' },
  });

  updatedStores({ count: 1 });
};
