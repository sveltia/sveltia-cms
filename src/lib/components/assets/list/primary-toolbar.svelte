<script>
  import { Button, Icon, Spacer, Toolbar } from '@sveltia/ui';
  import { _, locale as appLocale } from 'svelte-i18n';
  import CopyAssetsButton from '$lib/components/assets/toolbar/copy-assets-button.svelte';
  import DeleteAssetsButton from '$lib/components/assets/toolbar/delete-assets-button.svelte';
  import DownloadAssetsButton from '$lib/components/assets/toolbar/download-assets-button.svelte';
  import UploadAssetsButton from '$lib/components/assets/toolbar/upload-assets-button.svelte';
  import { focusedAsset, selectedAssetFolder, selectedAssets } from '$lib/services/assets';
  import { getFolderLabelByPath, listedAssets } from '$lib/services/assets/view';
  import { goto } from '$lib/services/navigation';

  $: assets = $selectedAssets;
</script>

<Toolbar variant="primary" aria-label={$_('folder')}>
  <h2 role="none">
    {$appLocale ? getFolderLabelByPath($selectedAssetFolder?.internalPath) : ''}
    {#if $selectedAssetFolder}
      <span role="none">/{$selectedAssetFolder.internalPath}</span>
    {/if}
  </h2>
  <Spacer flex />
  <Button
    variant="ghost"
    disabled={!$focusedAsset}
    label={$_('preview')}
    aria-label={$_('show_preview')}
    on:click={() => {
      goto(`/assets/${$focusedAsset?.path}`);
    }}
  >
    <Icon slot="start-icon" name="open_in_new" />
  </Button>
  <CopyAssetsButton {assets} />
  <DownloadAssetsButton {assets} />
  <DeleteAssetsButton
    {assets}
    buttonDescription={$_(assets.length === 1 ? 'delete_selected_asset' : 'delete_selected_assets')}
    dialogDescription={$_(
      // eslint-disable-next-line no-nested-ternary
      assets.length === 1
        ? 'confirm_deleting_selected_asset'
        : assets.length === $listedAssets.length
          ? 'confirm_deleting_all_assets'
          : 'confirm_deleting_selected_assets',
      { values: { count: assets.length } },
    )}
  />
  <UploadAssetsButton />
</Toolbar>
