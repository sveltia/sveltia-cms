<script>
  import { Button, Icon, Spacer, Toolbar } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import CopyAssetsButton from '$lib/components/assets/toolbar/copy-assets-button.svelte';
  import DeleteAssetsButton from '$lib/components/assets/toolbar/delete-assets-button.svelte';
  import DownloadAssetsButton from '$lib/components/assets/toolbar/download-assets-button.svelte';
  import EditOptionsButton from '$lib/components/assets/toolbar/edit-options-button.svelte';
  import { goBack } from '$lib/services/app/navigation';
  import { overlaidAsset, selectedAssetFolder } from '$lib/services/assets';

  const assets = $derived($overlaidAsset ? [$overlaidAsset] : []);
</script>

<Toolbar variant="primary" aria-label={$_('primary')}>
  <Button
    variant="ghost"
    iconic
    aria-label={$_('cancel_editing')}
    keyShortcuts="Escape"
    onclick={() => {
      goBack($selectedAssetFolder ? `/assets/${$selectedAssetFolder.internalPath}` : '/assets');
    }}
  >
    {#snippet startIcon()}
      <Icon name="arrow_back_ios_new" />
    {/snippet}
  </Button>
  <h2 role="none">
    <strong role="none">{$overlaidAsset?.name}</strong>
  </h2>
  <Spacer flex />
  <CopyAssetsButton {assets} />
  <DownloadAssetsButton {assets} />
  <DeleteAssetsButton
    {assets}
    buttonDescription={$_('delete_asset')}
    dialogDescription={$_('confirm_deleting_this_asset')}
    onDelete={() => {
      goBack($selectedAssetFolder ? `/assets/${$selectedAssetFolder.internalPath}` : '/assets');
    }}
  />
  <EditOptionsButton asset={$overlaidAsset} />
</Toolbar>
