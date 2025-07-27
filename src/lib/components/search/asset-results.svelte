<script>
  import { EmptyState, Group, InfiniteScroll } from '@sveltia/ui';
  import { sleep } from '@sveltia/utils/misc';
  import { _ } from 'svelte-i18n';

  import ListingGrid from '$lib/components/common/listing-grid.svelte';
  import AssetResultItem from '$lib/components/search/asset-result-item.svelte';
  import { announcedPageStatus } from '$lib/services/app/navigation';
  import { searchTerms } from '$lib/services/search';
  import { assetSearchResults } from '$lib/services/search/assets';

  /**
   * @import { Asset } from '$lib/types/private';
   */

  $effect(() => {
    const assetCount = $assetSearchResults.length;

    $announcedPageStatus = $_('viewing_asset_search_results', {
      values: {
        terms: $searchTerms,
        assets:
          assetCount > 1
            ? $_('many_assets', { values: { count: assetCount } })
            : assetCount === 1
              ? $_('one_asset')
              : $_('no_assets'),
      },
    });
  });
</script>

<Group aria-labelledby="search-results-assets">
  <h3 role="none" id="search-results-assets">{$_('assets')}</h3>
  <div role="none">
    {#if $assetSearchResults.length}
      <ListingGrid
        viewType="list"
        aria-label={$_('assets')}
        aria-rowcount={$assetSearchResults.length}
      >
        {#key $searchTerms}
          <InfiniteScroll items={$assetSearchResults} itemKey="path">
            {#snippet renderItem(/** @type {Asset} */ asset)}
              {#await sleep() then}
                <AssetResultItem {asset} />
              {/await}
            {/snippet}
          </InfiniteScroll>
        {/key}
      </ListingGrid>
    {:else if $searchTerms}
      <EmptyState>
        <span role="none">{$_('no_files_found')}</span>
      </EmptyState>
    {/if}
  </div>
</Group>
