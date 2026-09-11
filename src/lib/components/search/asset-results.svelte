<script>
  import { _ } from '@sveltia/i18n';
  import { EmptyState, Group, InfiniteScroll } from '@sveltia/ui';
  import { sleep } from '@sveltia/utils/misc';

  import ListingGrid from '$lib/components/common/listing-grid.svelte';
  import AssetResultItem from '$lib/components/search/asset-result-item.svelte';
  import { announcedPageStatus } from '$lib/services/app/navigation';
  import { searchTerms } from '$lib/services/search';
  import { assetSearchResults } from '$lib/services/search/assets';

  /**
   * @import { Asset } from '$lib/types/private';
   */

  $effect(() => {
    announcedPageStatus.current = _('viewing_asset_search_results', {
      values: {
        terms: searchTerms.current,
        count: assetSearchResults.current.length,
      },
    });
  });
</script>

<Group aria-labelledby="search-results-assets">
  <!-- <h3 role="none" id="search-results-assets">{_('assets')}</h3> -->
  <div role="none">
    {#if assetSearchResults.current.length}
      <ListingGrid
        viewType="list"
        aria-label={_('assets')}
        aria-rowcount={assetSearchResults.current.length}
      >
        {#key searchTerms.current}
          <InfiniteScroll items={assetSearchResults.current} itemKey="path">
            {#snippet renderItem(/** @type {Asset} */ asset)}
              {#await sleep() then}
                <AssetResultItem {asset} />
              {/await}
            {/snippet}
          </InfiniteScroll>
        {/key}
      </ListingGrid>
    {:else if searchTerms.current}
      <EmptyState>
        <span role="none">{_('no_files_found')}</span>
      </EmptyState>
    {/if}
  </div>
</Group>
