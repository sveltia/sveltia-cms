<!--
  @component Edit options menu for a repository asset: Edit, Rename, Replace and links to the file.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { MenuItem } from '@sveltia/ui';

  import EditOptionsMenu from '$lib/components/assets/list/edit-options-menu.svelte';
  import { defaultAssetDetails, getAssetDetails } from '$lib/services/assets/details';
  import { assetsLocked, hasReadonlyAsset } from '$lib/services/assets/folders';
  import { canEditAsset } from '$lib/services/assets/kinds';
  import { editingAsset, renamingAsset, uploadingAssets } from '$lib/services/assets/state';
  import { showUploadAssetsDialog } from '$lib/services/assets/view';
  import { backend } from '$lib/services/backends';
  import { prefs } from '$lib/services/user/prefs.svelte';
  import { watchAsync } from '$lib/services/utils/state.svelte';
  import { openNewTab } from '$lib/services/utils/window';

  /**
   * @import { Snippet } from 'svelte';
   * @import { Asset, AssetDetails } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {Asset} [asset] Selected asset.
   * @property {Snippet} [extraItems] Slot content.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    asset,
    extraItems = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  /** @type {AssetDetails} */
  let details = $state({ ...defaultAssetDetails });

  const { publicURL, repoBlobURL } = $derived(details);

  // The menu stays mounted while the focus moves from one asset to another, so a slow lookup for an
  // asset focused earlier must not overwrite the details of the one focused now, which `watchAsync`
  // takes care of
  watchAsync(
    () => {
      const _asset = asset;

      // Drop the previous asset’s links, so they’re not offered while this one’s are being
      // retrieved or once that fails
      details = { ...defaultAssetDetails };

      return _asset ? getAssetDetails(_asset) : Promise.resolve({ ...defaultAssetDetails });
    },
    (_details) => {
      details = _details;
    },
    (ex) => {
      // The file couldn’t be downloaded, so the public URL is unknown
      // eslint-disable-next-line no-console
      console.error(ex);
    },
  );
</script>

<!--
  Editing, renaming or replacing a file in the media library commits straight to the configured
  branch rather than going through review, so none of it is available to an Open Authoring
  contributor or a user who can’t push to the branch, nor for a file in a read-only folder
-->
<EditOptionsMenu
  readOnly={assetsLocked.current || (!!asset && hasReadonlyAsset([asset]))}
  canEdit={!!asset && canEditAsset(asset)}
  canRename={!!asset}
  canReplace={!!asset}
  onEdit={() => {
    editingAsset.current = asset;
  }}
  onRename={() => {
    renamingAsset.current = asset;
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
    {#if prefs.devModeEnabled}
      <MenuItem
        disabled={!backend.current?.repository || !repoBlobURL}
        label={backend.current?.repository?.label
          ? _('view_on_x', { values: { service: backend.current.repository.label } })
          : _('view_in_repository')}
        onclick={() => {
          openNewTab(`${repoBlobURL}?plain=1`);
        }}
      />
    {/if}
  {/snippet}
</EditOptionsMenu>
