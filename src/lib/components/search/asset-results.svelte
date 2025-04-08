<script>
  import { Group } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import EmptyState from '$lib/components/common/empty-state.svelte';
  import InfiniteScroll from '$lib/components/common/infinite-scroll.svelte';
  import ListingGrid from '$lib/components/common/listing-grid.svelte';
  import AssetResultItem from '$lib/components/search/asset-result-item.svelte';
  import { searchResults, searchTerms } from '$lib/services/search';

  /**
   * @import { Asset } from '$lib/types/private';
   */
</script>

<Group aria-labelledby="search-results-assets">
  <h3 role="none" id="search-results-assets">{$_('assets')}</h3>
  <div role="none">
    {#if $searchResults.assets.length}
      <ListingGrid
        viewType="list"
        aria-label={$_('assets')}
        aria-rowcount={$searchResults.assets.length}
      >
        {#key $searchTerms}
          <InfiniteScroll items={$searchResults.assets} itemKey="path">
            {#snippet renderItem(/** @type {Asset} */ asset)}
              <AssetResultItem {asset} />
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
