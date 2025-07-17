<script>
  import { EmptyState, GridBody, InfiniteScroll } from '@sveltia/ui';
  import { sleep } from '@sveltia/utils/misc';
  import { _ } from 'svelte-i18n';
  import AssetListItem from '$lib/components/assets/list/asset-list-item.svelte';
  import DropZone from '$lib/components/assets/shared/drop-zone.svelte';
  import UploadAssetsButton from '$lib/components/assets/toolbar/upload-assets-button.svelte';
  import ListContainer from '$lib/components/common/list-container.svelte';
  import ListingGrid from '$lib/components/common/listing-grid.svelte';
  import { uploadingAssets } from '$lib/services/assets';
  import { canCreateAsset, targetAssetFolder } from '$lib/services/assets/folders';
  import { assetGroups, currentView, listedAssets } from '$lib/services/assets/view';

  /**
   * @import { Asset } from '$lib/types/private';
   */

  const viewType = $derived($currentView.type);
  const folder = $derived($targetAssetFolder);
  const uploadDisabled = $derived(!canCreateAsset(folder));
</script>

<ListContainer aria-label={$_('asset_list')}>
  <DropZone
    disabled={uploadDisabled}
    multiple={true}
    onDrop={({ files }) => {
      $uploadingAssets = { folder, files };
    }}
  >
    {#if Object.values($assetGroups).flat(1).length}
      <ListingGrid
        id="asset-list"
        {viewType}
        aria-label={$_('assets')}
        aria-rowcount={$listedAssets.length}
      >
        {#each Object.entries($assetGroups) as [name, assets] (name)}
          {#await sleep() then}
            <GridBody label={name !== '*' ? name : undefined}>
              <InfiniteScroll items={assets} itemKey="path">
                {#snippet renderItem(/** @type {Asset} */ asset)}
                  {#key asset.sha}
                    {#await sleep() then}
                      <AssetListItem {asset} {viewType} />
                    {/await}
                  {/key}
                {/snippet}
              </InfiniteScroll>
            </GridBody>
          {/await}
        {/each}
      </ListingGrid>
    {:else}
      <EmptyState>
        <span role="none">{$_('no_files_found')}</span>
        {#if !uploadDisabled}
          <UploadAssetsButton label={$_('upload_assets')} />
        {/if}
      </EmptyState>
    {/if}
  </DropZone>
</ListContainer>
