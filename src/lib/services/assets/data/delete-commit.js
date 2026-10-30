import { deleteAssets } from '$lib/services/assets/data/delete';
import { runCommit } from '$lib/services/backends/commit-prompt';

/**
 * @import { Asset } from '$lib/types/private';
 */

/**
 * Delete the given assets in a commit, asking the user for a commit message if needed.
 * @param {Asset[]} assets List of assets to be deleted.
 * @returns {Promise<{ ok: boolean, failed: boolean }>} Outcome. `ok` is whether the assets have
 * been deleted, and `failed` whether the deletion has failed, which the UI reports. A cancellation
 * at the commit message prompt isn’t a failure.
 */
export const commitAssetDeletion = async (assets) => {
  const { ok, cancelled } = await runCommit(() => deleteAssets(assets));

  return { ok, failed: !ok && !cancelled };
};
