<script>
  import { Divider, Icon, Menu, MenuButton, MenuItem } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import {
    canEditAsset,
    editingAsset,
    getAssetDetails,
    renamingAsset,
    uploadingAssets,
  } from '$lib/services/assets';
  import { showUploadAssetsDialog } from '$lib/services/assets/view';
  import { backend } from '$lib/services/backends';

  /**
   * @type {Asset | undefined}
   */
  export let asset;

  /**
   * @type {string | undefined}
   */
  let publicURL = undefined;
  /**
   * @type {string | undefined}
   */
  let repoBlobURL = undefined;

  /**
   * Update the properties above.
   */
  const updateProps = async () => {
    ({ publicURL = undefined, repoBlobURL = undefined } = asset
      ? await getAssetDetails(asset)
      : {});
  };

  $: {
    void asset;
    updateProps();
  }
</script>

<MenuButton
  variant="ghost"
  iconic
  popupPosition="bottom-right"
  aria-label={$_('show_edit_options')}
>
  {#snippet startIcon()}
    <Icon name="more_vert" />
  {/snippet}
  {#snippet popup()}
    <Menu aria-label={$_('edit_options')}>
      <MenuItem
        variant="ghost"
        label={$_('edit')}
        aria-label={$_('edit_asset')}
        disabled={!asset || !canEditAsset(asset)}
        onclick={() => {
          $editingAsset = asset;
        }}
      />
      <MenuItem
        variant="ghost"
        label={$_('rename')}
        aria-label={$_('rename_asset')}
        disabled={!asset}
        onclick={() => {
          $renamingAsset = asset;
        }}
      />
      <MenuItem
        variant="ghost"
        label={$_('replace')}
        aria-label={$_('replace_asset')}
        disabled={!asset}
        onclick={() => {
          $uploadingAssets = { folder: undefined, files: [], originalAsset: asset };
          $showUploadAssetsDialog = true;
        }}
      />
      <Divider />
      <MenuItem
        label={$_('view_on_live_site')}
        disabled={!publicURL}
        onclick={() => {
          window.open(publicURL);
        }}
      />
      <MenuItem
        disabled={!$backend?.repository || !repoBlobURL}
        label={$_('view_on_x', {
          values: { service: $backend?.repository?.label },
          default: $_('view_in_repository'),
        })}
        onclick={() => {
          window.open(`${repoBlobURL}?plain=1`);
        }}
      />
    </Menu>
  {/snippet}
</MenuButton>
