<script>
  import { Spacer, Toolbar } from '@sveltia/ui';
  import { _, locale as appLocale } from 'svelte-i18n';
  import CopyAssetsButton from '$lib/components/assets/toolbar/copy-assets-button.svelte';
  import DeleteAssetsButton from '$lib/components/assets/toolbar/delete-assets-button.svelte';
  import DownloadAssetsButton from '$lib/components/assets/toolbar/download-assets-button.svelte';
  import EditOptionsButton from '$lib/components/assets/toolbar/edit-options-button.svelte';
  import PreviewAssetButton from '$lib/components/assets/toolbar/preview-asset-button.svelte';
  import UploadAssetsButton from '$lib/components/assets/toolbar/upload-assets-button.svelte';
  import FloatingActionButtonWrapper from '$lib/components/common/floating-action-button-wrapper.svelte';
  import BackButton from '$lib/components/common/page-toolbar/back-button.svelte';
  import { isMediumScreen, isSmallScreen } from '$lib/services/app/env';
  import { goBack } from '$lib/services/app/navigation';
  import {
    canCreateAsset,
    focusedAsset,
    selectedAssetFolder,
    selectedAssets,
  } from '$lib/services/assets';
  import { getFolderLabelByPath, listedAssets } from '$lib/services/assets/view';

  const assets = $derived.by(() => {
    if ($selectedAssets.length) return $selectedAssets;
    if ($focusedAsset) return [$focusedAsset];
    return [];
  });

  const uploadDisabled = $derived(!canCreateAsset($selectedAssetFolder));
</script>

<Toolbar variant="primary" aria-label={$_('folder')}>
  {#if $isSmallScreen}
    <BackButton
      aria-label={$_('back_to_asset_folder_list')}
      onclick={() => {
        goBack('/assets');
      }}
    />
  {/if}
  <h2 role="none">
    {$appLocale ? getFolderLabelByPath($selectedAssetFolder?.internalPath) : ''}
    {#if !$isSmallScreen && $selectedAssetFolder}
      <span role="none">/{$selectedAssetFolder.internalPath}</span>
    {/if}
  </h2>
  <Spacer flex />
  {#if !($isSmallScreen || $isMediumScreen)}
    <PreviewAssetButton asset={$focusedAsset} />
    <CopyAssetsButton assets={$focusedAsset ? [$focusedAsset] : []} />
    <DownloadAssetsButton {assets} />
    <DeleteAssetsButton
      {assets}
      buttonDescription={$_(
        assets.length === 1 ? 'delete_selected_asset' : 'delete_selected_assets',
      )}
      dialogDescription={$_(
        assets.length === 1
          ? 'confirm_deleting_selected_asset'
          : assets.length === $listedAssets.length
            ? 'confirm_deleting_all_assets'
            : 'confirm_deleting_selected_assets',
        { values: { count: assets.length } },
      )}
    />
    <EditOptionsButton asset={$focusedAsset} />
  {/if}
  <FloatingActionButtonWrapper>
    {#if !$isSmallScreen || ($listedAssets.length && !uploadDisabled)}
      <UploadAssetsButton label={$isSmallScreen ? undefined : $_('upload')} />
    {/if}
  </FloatingActionButtonWrapper>
</Toolbar>
