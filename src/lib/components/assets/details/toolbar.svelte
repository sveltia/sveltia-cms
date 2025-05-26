<script>
  import { Toolbar, TruncatedText } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import CopyAssetsButton from '$lib/components/assets/toolbar/copy-assets-button.svelte';
  import DeleteAssetsButton from '$lib/components/assets/toolbar/delete-assets-button.svelte';
  import DownloadAssetsButton from '$lib/components/assets/toolbar/download-assets-button.svelte';
  import EditOptionsButton from '$lib/components/assets/toolbar/edit-options-button.svelte';
  import BackButton from '$lib/components/common/page-toolbar/back-button.svelte';
  import { goBack } from '$lib/services/app/navigation';
  import { overlaidAsset, selectedAssetFolder } from '$lib/services/assets';
  import { isSmallScreen } from '$lib/services/user/env';

  const assets = $derived($overlaidAsset ? [$overlaidAsset] : []);
  const useButton = $derived(!$isSmallScreen);
</script>

{#snippet overflowButtons()}
  <CopyAssetsButton {assets} {useButton} />
  <DownloadAssetsButton {assets} {useButton} />
  <DeleteAssetsButton
    {assets}
    buttonDescription={$_('delete_asset')}
    dialogDescription={$_('confirm_deleting_this_asset')}
    onDelete={() => {
      goBack(`/assets/${$selectedAssetFolder?.internalPath ?? '-/all'}`);
    }}
    {useButton}
  />
{/snippet}

<Toolbar variant="primary" aria-label={$_('primary')}>
  <BackButton
    aria-label={$_('cancel_editing')}
    useShortcut={true}
    onclick={() => {
      goBack(`/assets/${$selectedAssetFolder?.internalPath ?? '-/all'}`);
    }}
  />
  <h2 role="none">
    <TruncatedText>
      {$overlaidAsset?.name}
    </TruncatedText>
  </h2>
  {#if !$isSmallScreen}
    {@render overflowButtons()}
  {/if}
  <EditOptionsButton asset={$overlaidAsset}>
    {#snippet extraItems()}
      {#if $isSmallScreen}
        {@render overflowButtons()}
      {/if}
    {/snippet}
  </EditOptionsButton>
</Toolbar>
