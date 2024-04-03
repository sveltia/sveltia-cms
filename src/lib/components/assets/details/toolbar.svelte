<script>
  import { Button, Icon, Spacer, Toolbar } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import CopyAssetsButton from '$lib/components/assets/toolbar/copy-assets-button.svelte';
  import DeleteAssetsButton from '$lib/components/assets/toolbar/delete-assets-button.svelte';
  import DownloadAssetsButton from '$lib/components/assets/toolbar/download-assets-button.svelte';
  import EditOptionsButton from '$lib/components/assets/toolbar/edit-options-button.svelte';
  import { overlaidAsset, selectedAssetFolder } from '$lib/services/assets';
  import { goBack } from '$lib/services/navigation';

  $: assets = $overlaidAsset ? [$overlaidAsset] : [];
</script>

<Toolbar variant="primary" aria-label={$_('primary')}>
  <Button
    variant="ghost"
    iconic
    aria-label={$_('cancel_editing')}
    keyShortcuts="Escape"
    on:click={() => {
      goBack($selectedAssetFolder ? `/assets/${$selectedAssetFolder.internalPath}` : '/assets');
    }}
  >
    <Icon slot="start-icon" name="arrow_back_ios_new" />
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
    on:delete={() => {
      goBack($selectedAssetFolder ? `/assets/${$selectedAssetFolder.internalPath}` : '/assets');
    }}
  />
  <EditOptionsButton asset={$overlaidAsset} />
</Toolbar>
