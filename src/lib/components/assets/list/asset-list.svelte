<script>
  import { GridBody } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import AssetListItem from '$lib/components/assets/list/asset-list-item.svelte';
  import DropZone from '$lib/components/assets/shared/drop-zone.svelte';
  import EmptyState from '$lib/components/common/empty-state.svelte';
  import ListContainer from '$lib/components/common/list-container.svelte';
  import ListingGrid from '$lib/components/common/listing-grid.svelte';
  import { selectedAssetFolder, uploadingAssets } from '$lib/services/assets';
  import { assetGroups, currentView, listedAssets } from '$lib/services/assets/view';
  import { siteConfig } from '$lib/services/config';
</script>

<ListContainer aria-label={$_('asset_list')}>
  {#if Object.values($assetGroups).flat(1).length}
    <DropZone
      multiple={true}
      on:select={({ detail: { files } }) => {
        $uploadingAssets = {
          folder: $selectedAssetFolder?.internalPath || $siteConfig.media_folder,
          files,
        };
      }}
    >
      <ListingGrid
        id="asset-list"
        viewType={$currentView.type}
        aria-label={$_('assets')}
        aria-rowcount={$listedAssets.length}
      >
        {#each Object.entries($assetGroups) as [name, assets] (name)}
          <GridBody label={name !== '*' ? name : undefined}>
            {#each assets as asset (asset.path)}
              <AssetListItem {asset} viewType={$currentView.type} />
            {/each}
          </GridBody>
        {/each}
      </ListingGrid>
    </DropZone>
  {:else}
    <EmptyState>
      <span role="none">{$_('no_files_found')}</span>
    </EmptyState>
  {/if}
</ListContainer>
