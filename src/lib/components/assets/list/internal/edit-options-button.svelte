<!--
  @component
  Edit options menu for a repository asset: Edit, Rename, Move, Replace and links to the file.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { MenuItem } from '@sveltia/ui';

  import EditOptionsMenu from '$lib/components/assets/list/edit-options-menu.svelte';
  import ViewInRepositoryItem from '$lib/components/common/view-in-repository-item.svelte';
  import { createAssetDetailsState } from '$lib/services/assets/details-state.svelte';
  import { assetsLocked, hasReadonlyAsset } from '$lib/services/assets/folders';
  import { canEditAsset } from '$lib/services/assets/kinds';
  import { canMoveAssets } from '$lib/services/assets/movable';
  import {
    assetMoveRequest,
    editingAsset,
    renamingAsset,
    uploadingAssets,
  } from '$lib/services/assets/state';
  import { showUploadAssetsDialog } from '$lib/services/assets/view';
  import { backend } from '$lib/services/backends';
  import { openNewTab } from '$lib/services/utils/window';

  /**
   * @import { Snippet } from 'svelte';
   * @import { Asset } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {Asset} [asset] Selected asset.
   * @property {Asset[]} [assets] Assets the Move item applies to, as several can be selected in the
   * list. Default: the selected asset.
   * @property {Snippet} [extraItems] Slot content.
   */

  /** @type {Props} */
  let { asset, assets = asset ? [asset] : [], extraItems = undefined } = $props();

  // The menu stays mounted while the focus moves from one asset to another
  const details = createAssetDetailsState(() => asset);

  const { publicURL, repoBlobURL } = $derived(details.current);
  // A file in a read-only folder can’t be edited, renamed or replaced
  const editable = $derived(!!asset && !hasReadonlyAsset([asset]));
</script>

<!--
  Editing, renaming or replacing a file in the media library commits straight to the configured
  branch rather than going through review, so none of it is available to an Open Authoring
  contributor or a user who can’t push to the branch, nor for a file in a read-only folder
-->
<EditOptionsMenu
  readOnly={assetsLocked.current}
  canEdit={editable && canEditAsset(/** @type {Asset} */ (asset))}
  canRename={editable}
  canReplace={editable}
  canMove={canMoveAssets(assets)}
  onEdit={() => {
    editingAsset.current = asset;
  }}
  onRename={() => {
    renamingAsset.current = asset;
  }}
  onMove={() => {
    assetMoveRequest.current = { assets: [...assets] };
  }}
  onReplace={() => {
    uploadingAssets.current = {
      folder: undefined,
      files: [],
      // The item is disabled without an asset
      originalAssets: [/** @type {Asset} */ (asset)],
    };
    showUploadAssetsDialog.current = true;
  }}
  {extraItems}
>
  {#snippet moreItems()}
    <MenuItem
      label={_('view_on_live_site')}
      disabled={!publicURL}
      onclick={() => {
        openNewTab(publicURL);
      }}
    />
    <ViewInRepositoryItem
      disabled={!backend.current?.repository || !repoBlobURL}
      onclick={() => {
        openNewTab(`${repoBlobURL}?plain=1`);
      }}
    />
  {/snippet}
</EditOptionsMenu>
