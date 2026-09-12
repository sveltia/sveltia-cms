<script>
  import { _ } from '@sveltia/i18n';
  import { EmptyState } from '@sveltia/ui';
  import { sleep } from '@sveltia/utils/misc';

  import CloudinaryPanel from '$lib/components/assets/browser/cloudinary-panel.svelte';
  import AssetListContainer from '$lib/components/assets/list/asset-list-container.svelte';
  import AssetListItem from '$lib/components/assets/list/external/asset-list-item.svelte';
  import UploadAssetsButton from '$lib/components/assets/list/external/upload-assets-button.svelte';
  import CloudServiceAuth from '$lib/components/assets/shared/cloud-service-auth.svelte';
  import ListContainer from '$lib/components/common/list-container.svelte';
  import {
    externalAssets,
    externalAssetsError,
    hasAuthInfo,
    selectedCloudService,
  } from '$lib/services/assets/external';
  import { uploadingExternalAssets } from '$lib/services/assets/external/data';
  import { listedExternalAssets } from '$lib/services/assets/external/view';
  import { currentView } from '$lib/services/assets/view';

  /**
   * @import { ExternalAsset, MediaLibraryService } from '$lib/types/private';
   */

  /** The component is only rendered while a service is selected. */
  const service = $derived(/** @type {MediaLibraryService} */ (selectedCloudService.current));
  const viewType = $derived(currentView.current.type);
  const uploadDisabled = $derived(!service.upload);
  /** @type {Record<string, ExternalAsset[]>} */
  const groups = $derived(
    listedExternalAssets.current.length
      ? { '*': listedExternalAssets.current }
      : /** @type {Record<string, ExternalAsset[]>} */ ({}),
  );
</script>

{#if service.authType === 'widget'}
  <!-- Cloudinary doesn’t allow API access from the browser, so its own widget is used instead -->
  <ListContainer aria-label={_('asset_list')}>
    {#if service.serviceId === 'cloudinary'}
      <CloudinaryPanel onSelect={() => undefined} />
    {/if}
  </ListContainer>
{:else if !hasAuthInfo(service) || externalAssetsError.current}
  <!-- The saved credentials may have been rejected, so let the user enter new ones on failure -->
  <ListContainer aria-label={_('asset_list')}>
    <CloudServiceAuth
      serviceProps={service}
      error={externalAssetsError.current
        ? _(`assets_dialog.error.${externalAssetsError.current}`)
        : undefined}
    />
  </ListContainer>
{:else if !externalAssets.current}
  <ListContainer aria-label={_('asset_list')}>
    <EmptyState>
      <span role="alert">{_('loading')}</span>
    </EmptyState>
  </ListContainer>
{:else}
  <AssetListContainer
    {groups}
    itemKey="id"
    totalCount={listedExternalAssets.current.length}
    {viewType}
    {uploadDisabled}
    onDrop={(files) => {
      uploadingExternalAssets.current = { files };
    }}
  >
    {#snippet renderItem(/** @type {ExternalAsset} */ asset, /** @type {number} */ index)}
      {#await sleep() then}
        <AssetListItem {asset} {index} {viewType} />
      {/await}
    {/snippet}
    {#snippet emptyAction()}
      <UploadAssetsButton label={_('upload_assets')} />
    {/snippet}
  </AssetListContainer>
{/if}
