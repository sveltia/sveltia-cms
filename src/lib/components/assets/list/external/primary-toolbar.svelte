<script>
  import { _ } from '@sveltia/i18n';

  import DeleteAssetsButton from '$lib/components/assets/list/delete-assets-button.svelte';
  import DownloadAssetsButton from '$lib/components/assets/list/download-assets-button.svelte';
  import CopyAssetsButton from '$lib/components/assets/list/external/copy-assets-button.svelte';
  import EditOptionsButton from '$lib/components/assets/list/external/edit-options-button.svelte';
  import UploadAssetsButton from '$lib/components/assets/list/external/upload-assets-button.svelte';
  import PreviewAssetButton from '$lib/components/assets/list/preview-asset-button.svelte';
  import PrimaryToolbar from '$lib/components/assets/list/primary-toolbar.svelte';
  import {
    canPreviewExternalAsset,
    externalAssets,
    focusedExternalAsset,
    getExternalAssetPath,
    selectedCloudService,
    selectedExternalAssets,
  } from '$lib/services/assets/external';
  import { deleteExternalAssets, fetchExternalAssetBlob } from '$lib/services/assets/external/data';
  import { env } from '$lib/services/user/env.svelte';

  /**
   * @import { MediaLibraryService } from '$lib/types/private';
   */

  /** The component is only rendered while a service is selected. */
  const service = $derived(/** @type {MediaLibraryService} */ (selectedCloudService.current));
  const asset = $derived(focusedExternalAsset.current);

  const assets = $derived.by(() => {
    if (selectedExternalAssets.current.length) return [...selectedExternalAssets.current];
    if (asset) return [asset];
    return [];
  });
</script>

<PrimaryToolbar title={service.serviceLabel}>
  {#snippet actions()}
    <PreviewAssetButton
      path={asset ? getExternalAssetPath(service, asset) : undefined}
      disabled={!asset || !canPreviewExternalAsset(asset)}
    />
    <CopyAssetsButton assets={asset ? [asset] : []} />
    <DownloadAssetsButton {assets} getName={(a) => a.fileName} getBlob={fetchExternalAssetBlob} />
    <DeleteAssetsButton
      {assets}
      disabled={!service.delete}
      deleteAssets={deleteExternalAssets}
      buttonDescription={_('delete_selected_assets', { values: { count: assets.length } })}
      dialogDescription={_(
        assets.length > 1 && assets.length === externalAssets.current?.length
          ? 'confirm_deleting_all_assets'
          : 'confirm_deleting_selected_assets',
        { values: { count: assets.length } },
      )}
    />
    <EditOptionsButton {asset} />
  {/snippet}
  {#snippet fab()}
    {#if !env.isSmallScreen || (externalAssets.current?.length && service.upload)}
      <UploadAssetsButton label={env.isSmallScreen ? undefined : _('upload')} />
    {/if}
  {/snippet}
</PrimaryToolbar>
