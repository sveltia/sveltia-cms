import { getHash } from '@sveltia/utils/crypto';
import { get } from 'svelte/store';
import {
  allAssets,
  focusedAsset,
  getAssetKind,
  getAssetsByDirName,
  overlaidAsset,
} from '$lib/services/assets';
import { assetUpdatesToast } from '$lib/services/assets/data';
import { backend } from '$lib/services/backends';
import { siteConfig } from '$lib/services/config';
import { UPDATE_TOAST_DEFAULT_STATE } from '$lib/services/contents/collection/data';
import { renameIfNeeded, sanitizeFileName } from '$lib/services/utils/file';

/**
 * @import { Asset, CommitAction, CommitChangesOptions, UploadingAssets } from '$lib/types/private';
 */

/**
 * Create a list of file objects to be uploaded, ensuring that names are unique and sanitized.
 * @param {UploadingAssets} uploadingAssets Assets to be uploaded.
 * @returns {{ action: CommitAction, name: string, path: string, file: File }[]} An array of objects
 * representing the files to be uploaded, each containing the action type, name, path, and file
 * object.
 */
const createFileList = (uploadingAssets) => {
  const { files, folder, originalAsset } = uploadingAssets;

  const assetNamesInSameFolder =
    folder?.internalPath !== undefined
      ? getAssetsByDirName(folder.internalPath).map((a) => a.name.normalize())
      : [];

  return files.map((file) => {
    const name =
      originalAsset?.name ?? renameIfNeeded(sanitizeFileName(file.name), assetNamesInSameFolder);

    if (!assetNamesInSameFolder.includes(name)) {
      assetNamesInSameFolder.push(name);
    }

    return {
      action: /** @type {CommitAction} */ (originalAsset ? 'update' : 'create'),
      name,
      path: [folder?.internalPath, name].join('/'),
      file,
    };
  });
};

/**
 * Update the asset stores with new assets, ensuring that focused and overlaid assets are refreshed,
 * and displays a toast notification about the asset updates.
 * @param {Asset[]} newAssets An array of new assets to be merged into the existing assets store.
 * @param {File[]} files An array of files that were uploaded, used to update the toast
 * notification.
 */
const updatedStores = (newAssets, files) => {
  allAssets.update((assets) => [
    ...assets.filter((a) => !newAssets.some((na) => na.path === a.path)),
    ...newAssets,
  ]);

  const _focusedAsset = get(focusedAsset);
  const _overlaidAsset = get(overlaidAsset);

  // Replace the existing asset
  if (_focusedAsset) {
    focusedAsset.set(get(allAssets).find((a) => a.path === _focusedAsset.path));
  }

  // Replace the existing asset
  if (_overlaidAsset) {
    overlaidAsset.set(get(allAssets).find((a) => a.path === _overlaidAsset.path));
  }

  const autoDeployEnabled = get(siteConfig)?.backend.automatic_deployments;

  assetUpdatesToast.set({
    ...UPDATE_TOAST_DEFAULT_STATE,
    saved: true,
    published: !!get(backend)?.isGit && autoDeployEnabled === true,
    count: files.length,
  });
};

/**
 * Upload/save the given assets to the backend.
 * @param {UploadingAssets} uploadingAssets Assets to be uploaded.
 * @param {CommitChangesOptions} options Options for the backend handler.
 */
export const saveAssets = async (uploadingAssets, options) => {
  const { files, folder } = uploadingAssets;
  const savingFileList = createFileList(uploadingAssets);

  await get(backend)?.commitChanges(
    savingFileList.map(({ action, path, file }) => ({ action, path, data: file })),
    options,
  );

  /** @type {Asset[]} */
  const newAssets = await Promise.all(
    savingFileList.map(
      async ({ name, path, file }) =>
        /** @type {Asset} */ ({
          blobURL: URL.createObjectURL(file),
          name,
          path,
          sha: await getHash(file),
          size: file.size,
          kind: getAssetKind(name),
          text: undefined,
          folder,
        }),
    ),
  );

  updatedStores(newAssets, files);
};
