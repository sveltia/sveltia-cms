import { focusedAsset } from '$lib/services/assets';
import { assetUpdatesToast } from '$lib/services/assets/data';
import { planAssetDeletion } from '$lib/services/assets/data/cascade';
import { saveChanges } from '$lib/services/backends/save';
import { UPDATE_TOAST_DEFAULT_STATE } from '$lib/services/contents/collection/data';
import { buildTargetChanges } from '$lib/services/contents/entry/cascade';

/**
 * @import { Asset, FileChange } from '$lib/types/private';
 */

/**
 * Update the asset stores after deleting assets.
 * @param {object} args Arguments.
 * @param {Asset[]} args.assets List of assets that have been deleted.
 */
export const updateStores = ({ assets }) => {
  // Clear asset info in the sidebar
  if (assets.some(({ path }) => focusedAsset.current?.path === path)) {
    focusedAsset.current = undefined;
  }

  assetUpdatesToast.current = {
    ...UPDATE_TOAST_DEFAULT_STATE,
    deleted: true,
    count: assets.length,
  };
};

/**
 * Delete the given assets from the backend and update the asset stores. The entries using the
 * assets are rewritten in the same commit so that no reference is left dangling.
 * @param {Asset[]} assets List of assets to be deleted.
 * @throws {Error} When removing the references would leave an entry invalid, e.g. a required Image
 * field with nothing left. The dialog reports this before the deletion is confirmed, so this is
 * only a safeguard.
 */
export const deleteAssets = async (assets) => {
  const { targets, blockers } = await planAssetDeletion(assets);

  if (blockers.length) {
    throw new Error('Cannot delete assets that entries require', { cause: blockers });
  }

  const { changes: cascadeChanges, savingEntries } = await buildTargetChanges({ targets });

  await saveChanges({
    changes: [
      ...assets.map(
        ({ path, sha }) => /** @type {FileChange} */ ({ action: 'delete', path, previousSha: sha }),
      ),
      ...cascadeChanges,
    ],
    savingEntries,
    options: { commitType: 'deleteMedia' },
  });

  updateStores({ assets });
};
