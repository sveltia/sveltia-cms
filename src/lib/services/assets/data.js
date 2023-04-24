import { get } from 'svelte/store';
import { allAssetPaths, allAssets, getAssetKind } from '$lib/services/assets';
import { backend } from '$lib/services/backends';
import { getHash } from '$lib/services/utils/files';

/**
 * Upload/save the given assets to the backend.
 * @param {object} uploadingAssets  Assets to be uploaded.
 * @param {File[]} uploadingAssets.files File list.
 * @param {string} uploadingAssets.folder Target folder name.
 * @param {object} [options] Options for the backend handler.
 */
export const saveAssets = async ({ files, folder }, options) => {
  await get(backend).saveFiles(
    files.map((file) => ({
      path: [folder, file.name].join('/'),
      data: file,
    })),
    options,
  );

  const { collectionName = null } =
    get(allAssetPaths).findLast(({ internalPath }) => folder === internalPath) || {};

  /** @type {Asset[]} */
  const newAssets = await Promise.all(
    files.map(async (file) => ({
      name: file.name,
      path: [folder, file.name].join('/'),
      sha: await getHash(file),
      size: file.size,
      kind: getAssetKind(file.name),
      text: null,
      collectionName,
      folder,
      tempURL: URL.createObjectURL(file),
    })),
  );

  allAssets.update((assets) => [
    ...assets.filter((a) => !newAssets.some((na) => na.path === a.path)),
    ...newAssets,
  ]);
};

/**
 * Delete the given assets.
 * @param {Asset[]} assets List of assets to be deleted.
 * @todo Update entries to remove these asset paths.
 */
export const deleteAssets = async (assets) => {
  const items = assets.map(({ path }) => ({ path }));

  await get(backend).deleteFiles(items, { commitType: 'deleteMedia' });
  allAssets.update((_allAssets) => _allAssets.filter((asset) => !assets.includes(asset)));
};

/**
 * Move assets between folders.
 * @param {Assets[]} assets Assets.
 * @param {string} directory Target directory.
 * @todo Implement this!
 */
export const moveAssets = async (assets, directory) => {
  // eslint-disable-next-line no-console
  console.info(assets, directory);
};
