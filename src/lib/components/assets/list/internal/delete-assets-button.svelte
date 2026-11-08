<!--
  @component
  Delete button for repository assets, which commits the deletion along with the updates to the
  entries using the assets, and reports a failure.
-->
<script>
  import DeleteAssetsButton from '$lib/components/assets/list/delete-assets-button.svelte';
  import { planAssetDeletion } from '$lib/services/assets/data/cascade';
  import { runAssetCommit } from '$lib/services/assets/data/commit';
  import { deleteAssets } from '$lib/services/assets/data/delete';
  import { assetsLocked, hasReadonlyAsset } from '$lib/services/assets/folders';

  /**
   * @import { Asset } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {Asset[]} [assets] Selected assets.
   * @property {number} [listedCount] Number of the assets listed in the view, given when the
   * selected assets are deleted rather than the asset shown in the details overlay.
   * @property {(() => void) | undefined} [onDelete] Called once the assets have been deleted.
   * @property {boolean} [useButton] Whether to use the Button component.
   */

  /** @type {Props} */
  let { assets = [], listedCount = undefined, onDelete = undefined, useButton = true } = $props();
</script>

<!--
  Deleting a file from the media library commits straight to the configured branch rather than
  going through review, so it’s not something an Open Authoring contributor or a user who can’t
  push to the branch can do
-->
<DeleteAssetsButton
  {assets}
  disabled={assetsLocked.current || hasReadonlyAsset(assets)}
  deleteAssets={async (_assets) =>
    // On failure, stay on the asset, which is still there
    (await runAssetCommit(() => deleteAssets(_assets), { failure: 'deleting_assets_failed' })).ok}
  planDeletion={planAssetDeletion}
  {listedCount}
  {onDelete}
  {useButton}
/>
