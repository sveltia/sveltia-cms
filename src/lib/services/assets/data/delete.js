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
 * @param {boolean} [args.notify] Whether to show a toast reporting the deletion. Default: `true`.
 */
export const updateStores = ({ assets, notify = true }) => {
  // Clear asset info in the sidebar
  if (assets.some(({ path }) => focusedAsset.current?.path === path)) {
    focusedAsset.current = undefined;
  }

  if (notify) {
    assetUpdatesToast.current = {
      ...UPDATE_TOAST_DEFAULT_STATE,
      deleted: true,
      count: assets.length,
    };
  }
};

/**
 * Delete the given assets from the backend and update the asset stores. The entries using the
 * assets are rewritten in the same commit so that no reference is left dangling.
 * @param {Asset[]} assets List of assets to be deleted.
 * @param {object} [options] Options.
 * @param {FileChange[]} [options.extraChanges] Changes to files other than the assets, committed
 * along with the deletion, e.g. the `.gitkeep` of a folder being deleted.
 * @param {boolean} [options.notify] Whether to show a toast reporting the deletion. Default:
 * `true`. A caller that reports the result in its own words, like a folder deletion, turns it off.
 * @throws {Error} When removing the references would leave an entry invalid, e.g. a required Image
 * field with nothing left. The dialog reports this before the deletion is confirmed, so this is
 * only a safeguard.
 */
export const deleteAssets = async (assets, { extraChanges = [], notify = true } = {}) => {
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
      ...extraChanges,
    ],
    savingEntries,
    options: { commitType: 'deleteMedia' },
  });

  updateStores({ assets, notify });
};
