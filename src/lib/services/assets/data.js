import { getHash } from '@sveltia/utils/crypto';
import { escapeRegExp } from '@sveltia/utils/string';
import { get, writable } from 'svelte/store';
import {
  allAssetFolders,
  allAssets,
  focusedAsset,
  getAssetKind,
  overlaidAsset,
} from '$lib/services/assets';
import { backend, backendName } from '$lib/services/backends';
import { siteConfig } from '$lib/services/config';
import { renameIfNeeded } from '$lib/services/utils/file';

/**
 * @type {import('svelte/store').Writable<UpdatesToastState>}
 */
export const assetUpdatesToast = writable({
  count: 1,
  saved: false,
  deleted: false,
  published: false,
});

/**
 * Upload/save the given assets to the backend.
 * @param {UploadingAssets} uploadingAssets - Assets to be uploaded.
 * @param {CommitChangesOptions} options - Options for the backend handler.
 */
export const saveAssets = async (uploadingAssets, options) => {
  const { files, folder, originalAsset } = uploadingAssets;

  const assetNamesInSameFolder = /** @type {string[]} */ (
    get(allAssets)
      .map((a) => a.path)
      .filter((p) => p.match(`^${escapeRegExp(/** @type {string} */ (folder))}\\/[^\\/]+$`))
      .map((p) => p.split('/').pop())
  );

  const savingFileList = files.map((file) => {
    const name = originalAsset?.name ?? renameIfNeeded(file.name, assetNamesInSameFolder);

    if (!assetNamesInSameFolder.includes(name)) {
      assetNamesInSameFolder.push(name);
    }

    return {
      action: /** @type {CommitAction} */ (originalAsset ? 'update' : 'create'),
      name,
      path: [folder, name].join('/'),
      file,
    };
  });

  await get(backend)?.commitChanges(
    savingFileList.map(({ action, path, file }) => ({ action, path, data: file })),
    options,
  );

  const { collectionName } =
    get(allAssetFolders).findLast(({ internalPath }) => folder === internalPath) ?? {};

  /**
   * @type {Asset[]}
   */
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
          collectionName,
          folder,
        }),
    ),
  );

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

  const isLocal = get(backendName) === 'local';

  const { backend: { automatic_deployments: autoDeployEnabled = undefined } = {} } =
    get(siteConfig) ?? /** @type {SiteConfig} */ ({});

  assetUpdatesToast.set({
    count: files.length,
    saved: true,
    published: !isLocal && autoDeployEnabled === true,
  });
};

/**
 * Delete the given assets.
 * @param {Asset[]} assets - List of assets to be deleted.
 * @todo Update entries to remove these asset paths. If an asset is used for a required field, show
 * an error message and abort the operation.
 */
export const deleteAssets = async (assets) => {
  await get(backend)?.commitChanges(
    assets.map(({ path }) => ({ action: 'delete', path })),
    { commitType: 'deleteMedia' },
  );

  allAssets.update((_allAssets) => _allAssets.filter((asset) => !assets.includes(asset)));
  assetUpdatesToast.set({ deleted: true, count: assets.length });
};

/**
 * Move assets between folders.
 * @param {Asset[]} assets - Assets.
 * @param {string} directory - Target directory.
 * @todo Implement this!
 */
export const moveAssets = async (assets, directory) => {
  // eslint-disable-next-line no-console
  console.info(assets, directory);
};
