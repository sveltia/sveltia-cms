import { get } from 'svelte/store';
import { allAssets, focusedAsset } from '$lib/services/assets';
import { assetUpdatesToast } from '$lib/services/assets/data';
import { backend } from '$lib/services/backends';
import { UPDATE_TOAST_DEFAULT_STATE } from '$lib/services/contents/collection/data';

/**
 * @import { Asset } from '$lib/types/private';
 */

/**
 * Update the asset stores after deleting assets.
 * @param {Asset[]} assets List of assets that have been deleted.
 */
const updateStores = (assets) => {
  allAssets.update((_allAssets) => _allAssets.filter((asset) => !assets.includes(asset)));

  // Clear asset info in the sidebar
  focusedAsset.update((_focusedAsset) =>
    assets.some(({ path }) => _focusedAsset?.path === path) ? undefined : _focusedAsset,
  );

  assetUpdatesToast.set({
    ...UPDATE_TOAST_DEFAULT_STATE,
    deleted: true,
    count: assets.length,
  });
};

/**
 * Delete the given assets from the backend and update the asset stores.
 * @param {Asset[]} assets List of assets to be deleted.
 * @todo Update entries to remove these asset paths. If an asset is used for a required field, show
 * an error message and abort the operation.
 * @todo Validate entry field constraints, such as required fields, before deleting the assets.
 */
export const deleteAssets = async (assets) => {
  await get(backend)?.commitChanges(
    assets.map(({ path }) => ({ action: 'delete', path })),
    { commitType: 'deleteMedia' },
  );

  updateStores(assets);
};
