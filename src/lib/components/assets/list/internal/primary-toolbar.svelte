<script>
  import { _, locale as appLocale } from '@sveltia/i18n';

  import DeleteAssetsButton from '$lib/components/assets/list/delete-assets-button.svelte';
  import DownloadAssetsButton from '$lib/components/assets/list/download-assets-button.svelte';
  import CopyAssetsButton from '$lib/components/assets/list/internal/copy-assets-button.svelte';
  import EditOptionsButton from '$lib/components/assets/list/internal/edit-options-button.svelte';
  import UploadAssetsButton from '$lib/components/assets/list/internal/upload-assets-button.svelte';
  import PreviewAssetButton from '$lib/components/assets/list/preview-asset-button.svelte';
  import PrimaryToolbar from '$lib/components/assets/list/primary-toolbar.svelte';
  import { focusedAsset, selectedAssets } from '$lib/services/assets';
  import { deleteAssets } from '$lib/services/assets/data/delete';
  import {
    canCreateAsset,
    selectedAssetFolder,
    targetAssetFolder,
  } from '$lib/services/assets/folders';
  import { getAssetBlob } from '$lib/services/assets/info';
  import { canPreviewAsset } from '$lib/services/assets/kinds';
  import { getFolderLabelByCollection, listedAssets } from '$lib/services/assets/view';
  import { env } from '$lib/services/user/env.svelte';
  import { openAuthoring } from '$lib/services/workflow/open-authoring';

  const folder = $derived(selectedAssetFolder.current);
  // `appLocale.current` is a key, because `getFolderLabelByCollection` can return a localized label
  const title = $derived(appLocale.current && folder ? getFolderLabelByCollection(folder) : '');
  const asset = $derived(focusedAsset.current);

  const assets = $derived.by(() => {
    if (selectedAssets.current.length) return [...selectedAssets.current];
    if (asset) return [asset];
    return [];
  });

  // Uploading to the media library commits straight to the configured branch rather than going
  // through review, so it’s not something an Open Authoring contributor can do. An asset attached
  // to an entry is committed with that entry, so it’s unaffected
  const uploadDisabled = $derived(
    openAuthoring.current || !canCreateAsset(targetAssetFolder.current),
  );
</script>

<PrimaryToolbar {title} path={folder?.internalPath}>
  {#snippet actions()}
    <PreviewAssetButton
      path={asset ? `/assets/${asset.path}` : undefined}
      disabled={!asset || !canPreviewAsset(asset)}
    />
    <CopyAssetsButton assets={asset ? [asset] : []} />
    <DownloadAssetsButton {assets} getName={(a) => a.name} getBlob={getAssetBlob} />
    <!--
        Deleting a file from the media library commits straight to the configured branch rather
        than going through review, so it’s not something an Open Authoring contributor can do
      -->
    <DeleteAssetsButton
      {assets}
      disabled={openAuthoring.current}
      deleteAssets={(_assets) => {
        // Don’t wait for the commit; the list is updated optimistically
        deleteAssets(_assets);
      }}
      buttonDescription={_('delete_selected_assets', { values: { count: assets.length } })}
      dialogDescription={_(
        assets.length > 1 && assets.length === listedAssets.current.length
          ? 'confirm_deleting_all_assets'
          : 'confirm_deleting_selected_assets',
        { values: { count: assets.length } },
      )}
    />
    <EditOptionsButton {asset} />
  {/snippet}
  {#snippet fab()}
    {#if !env.isSmallScreen || (listedAssets.current.length && !uploadDisabled)}
      <UploadAssetsButton label={env.isSmallScreen ? undefined : _('upload')} />
    {/if}
  {/snippet}
</PrimaryToolbar>
