<script>
  import { Icon, Menu, MenuButton, MenuItem } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { canEditAsset, editingAsset, uploadingAssets } from '$lib/services/assets';
  import { showUploadAssetsDialog } from '$lib/services/assets/view';

  /**
   * @type {Asset | undefined}
   */
  export let asset;
</script>

<MenuButton
  variant="ghost"
  iconic
  popupPosition="bottom-right"
  aria-label={$_('show_edit_options')}
>
  <Icon slot="start-icon" name="more_vert" />
  <Menu slot="popup" aria-label={$_('edit_options')}>
    <MenuItem
      variant="ghost"
      label={$_('edit')}
      aria-label={$_('edit_asset')}
      disabled={!asset || !canEditAsset(asset)}
      on:click={() => {
        $editingAsset = asset;
      }}
    />
    <MenuItem
      variant="ghost"
      label={$_('replace')}
      aria-label={$_('replace_asset')}
      disabled={!asset}
      on:click={() => {
        $uploadingAssets = { folder: undefined, files: [], originalAsset: asset };
        $showUploadAssetsDialog = true;
      }}
    />
  </Menu>
</MenuButton>
