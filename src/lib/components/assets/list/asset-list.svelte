<script>
  import { GridBody } from '@sveltia/ui';
  import { sleep } from '@sveltia/utils/misc';
  import { _ } from 'svelte-i18n';
  import AssetListItem from '$lib/components/assets/list/asset-list-item.svelte';
  import DropZone from '$lib/components/assets/shared/drop-zone.svelte';
  import EmptyState from '$lib/components/common/empty-state.svelte';
  import ListContainer from '$lib/components/common/list-container.svelte';
  import ListingGrid from '$lib/components/common/listing-grid.svelte';
  import { globalAssetFolder, selectedAssetFolder, uploadingAssets } from '$lib/services/assets';
  import { assetGroups, currentView, listedAssets } from '$lib/services/assets/view';

  // Can’t upload assets if collection assets are saved at entry-relative paths
  $: uploadDisabled = !!$selectedAssetFolder?.entryRelative;
</script>

<ListContainer aria-label={$_('asset_list')}>
  <DropZone
    disabled={uploadDisabled}
    multiple={true}
    on:select={({ detail: { files } }) => {
      $uploadingAssets = {
        folder: $selectedAssetFolder?.internalPath || $globalAssetFolder?.internalPath,
        files,
      };
    }}
  >
    {#if Object.values($assetGroups).flat(1).length}
      <ListingGrid
        id="asset-list"
        viewType={$currentView.type}
        aria-label={$_('assets')}
        aria-rowcount={$listedAssets.length}
      >
        {#each Object.entries($assetGroups) as [name, assets] (name)}
          <GridBody label={name !== '*' ? name : undefined}>
            {#each assets as asset (asset.path)}
              {#key asset.sha}
                {#await sleep(0) then}
                  <AssetListItem {asset} viewType={$currentView.type} />
                {/await}
              {/key}
            {/each}
          </GridBody>
        {/each}
      </ListingGrid>
    {:else}
      <EmptyState>
        <span role="none">{$_('no_files_found')}</span>
      </EmptyState>
    {/if}
  </DropZone>
</ListContainer>
