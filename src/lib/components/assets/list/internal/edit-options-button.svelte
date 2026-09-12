<!--
  @component Edit options menu for a repository asset: Edit, Rename, Replace and links to the file.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { MenuItem } from '@sveltia/ui';

  import EditOptionsMenu from '$lib/components/assets/list/edit-options-menu.svelte';
  import { editingAsset, renamingAsset, uploadingAssets } from '$lib/services/assets';
  import { defaultAssetDetails, getAssetDetails } from '$lib/services/assets/details';
  import { canEditAsset } from '$lib/services/assets/kinds';
  import { showUploadAssetsDialog } from '$lib/services/assets/view';
  import { backend } from '$lib/services/backends';
  import { prefs } from '$lib/services/user/prefs.svelte';
  import { openNewTab } from '$lib/services/utils/window';
  import { openAuthoring } from '$lib/services/workflow/open-authoring';

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

  /**
   * Update the properties above.
   */
  const updateProps = async () => {
    details = asset ? await getAssetDetails(asset) : { ...defaultAssetDetails };
  };

  $effect(() => {
    void [asset];
    updateProps();
  });
</script>

<!--
  Editing, renaming or replacing a file in the media library commits straight to the configured
  branch rather than going through review, so none of it is available to an Open Authoring
  contributor
-->
<EditOptionsMenu
  readOnly={openAuthoring.current}
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
      originalAssets: asset ? [asset] : [],
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
        label={_('view_on_x', {
          values: { service: backend.current?.repository?.label },
          default: _('view_in_repository'),
        })}
        onclick={() => {
          openNewTab(`${repoBlobURL}?plain=1`);
        }}
      />
    {/if}
  {/snippet}
</EditOptionsMenu>
