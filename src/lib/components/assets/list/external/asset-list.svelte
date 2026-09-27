<script>
  import { _ } from '@sveltia/i18n';
  import { EmptyState } from '@sveltia/ui';
  import { sleep } from '@sveltia/utils/misc';

  import CloudinaryPanel from '$lib/components/assets/browser/cloudinary-panel.svelte';
  import AssetListContainer from '$lib/components/assets/list/asset-list-container.svelte';
  import AssetListItem from '$lib/components/assets/list/external/asset-list-item.svelte';
  import SubfolderListItem from '$lib/components/assets/list/external/subfolder-list-item.svelte';
  import UploadAssetsButton from '$lib/components/assets/list/external/upload-assets-button.svelte';
  import CloudServiceAuth from '$lib/components/assets/shared/cloud-service-auth.svelte';
  import ListContainer from '$lib/components/common/list-container.svelte';
  import {
    externalAssets,
    externalAssetsError,
    focusedExternalAsset,
    focusedExternalSubfolder,
    hasAuthInfo,
    selectedCloudService,
  } from '$lib/services/assets/external';
  import { uploadingExternalAssets } from '$lib/services/assets/external/data';
  import {
    externalAssetGroups,
    listedExternalAssets,
    listedExternalSubfolders,
  } from '$lib/services/assets/external/view';
  import { currentView } from '$lib/services/assets/view/settings';

  /**
   * @import { ExternalAsset, MediaLibraryService } from '$lib/types/private';
   */

  /** The component is only rendered while a service is selected. */
  const service = $derived(/** @type {MediaLibraryService} */ (selectedCloudService.current));
  const viewType = $derived(currentView.current.type);
  const uploadDisabled = $derived(!service.upload);
  const subfolderCount = $derived(listedExternalSubfolders.current.length);
  /**
   * Row index of each listed asset, counted across the groups rather than within each one, as the
   * rows of every group make up one grid. The subfolders come first, so they offset the index.
   */
  const rowIndexMap = $derived(
    new Map(
      Object.values(externalAssetGroups.current)
        .flat(1)
        .map(({ id }, index) => [id, index + subfolderCount]),
    ),
  );

  /**
   * Get the row index of a listed asset.
   * @param {ExternalAsset} asset Asset.
   * @returns {number} 0-based index.
   */
  const getRowIndex = (asset) => /** @type {number} */ (rowIndexMap.get(asset.id));
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
    groups={externalAssetGroups.current}
    itemKey="id"
    totalCount={subfolderCount + listedExternalAssets.current.length}
    hasSubfolders={!!subfolderCount}
    {viewType}
    {uploadDisabled}
    onDrop={(files) => {
      uploadingExternalAssets.current = { files };
    }}
    onBlankClick={() => {
      // Show the info of the folder being browsed in place of an asset’s or a subfolder’s
      focusedExternalAsset.current = undefined;
      focusedExternalSubfolder.current = undefined;
    }}
  >
    {#snippet subfolders()}
      {#each listedExternalSubfolders.current as subfolder, index (subfolder.path)}
        <SubfolderListItem {subfolder} rowIndex={index} {viewType} />
      {/each}
    {/snippet}
    {#snippet renderItem(/** @type {ExternalAsset} */ asset)}
      {#await sleep() then}
        <AssetListItem {asset} index={getRowIndex(asset)} {viewType} />
      {/await}
    {/snippet}
    {#snippet emptyAction()}
      <UploadAssetsButton label={_('upload_assets')} />
    {/snippet}
  </AssetListContainer>
{/if}
