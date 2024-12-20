<script>
  import { Divider, Menu, MenuButton, MenuItem } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import {
    canEditAsset,
    defaultAssetDetails,
    editingAsset,
    getAssetDetails,
    renamingAsset,
    uploadingAssets,
  } from '$lib/services/assets';
  import { showUploadAssetsDialog } from '$lib/services/assets/view';
  import { backend } from '$lib/services/backends';
  import { prefs } from '$lib/services/prefs';

  /**
   * @typedef {object} Props
   * @property {Asset} [asset] - Selected asset.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    asset,
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
    void asset;
    updateProps();
  });
</script>

<MenuButton
  variant="ghost"
  iconic
  popupPosition="bottom-right"
  aria-label={$_('show_edit_options')}
>
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
      {#if $prefs.devModeEnabled}
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
      {/if}
    </Menu>
  {/snippet}
</MenuButton>
