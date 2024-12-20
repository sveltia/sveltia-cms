<svelte:options runes={true} />

<script>
  import { Group } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import InfiniteScroll from '$lib/components/common/infinite-scroll.svelte';
  import ListingGrid from '$lib/components/common/listing-grid.svelte';
  import AssetResultItem from '$lib/components/search/asset-result-item.svelte';
  import EntryResultItem from '$lib/components/search/entry-result-item.svelte';
  import { searchResults, searchTerms } from '$lib/services/search';
</script>

<div role="none" class="wrapper">
  <header role="none">
    <h2 role="none">{$_('search_results_for_x', { values: { terms: $searchTerms } })}</h2>
  </header>
  <div role="none" class="results">
    <Group aria-labelledby="search-results-entries">
      <h3 role="none" id="search-results-entries">{$_('entries')}</h3>
      <div role="none">
        {#if $searchResults?.entries?.length}
          <ListingGrid
            viewType="list"
            aria-label={$_('entries')}
            aria-rowcount={$searchResults.entries.length}
          >
            {#key $searchTerms}
              <InfiniteScroll items={$searchResults.entries} itemKey="id">
                {#snippet renderItem(/** @type {Entry} */ entry)}
                  <EntryResultItem {entry} />
                {/snippet}
              </InfiniteScroll>
            {/key}
          </ListingGrid>
        {:else}
          {$_('no_entries_found')}
        {/if}
      </div>
    </Group>
    <Group aria-labelledby="search-results-assets">
      <h3 role="none" id="search-results-assets">{$_('assets')}</h3>
      <div role="none">
        {#if $searchResults?.assets?.length}
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
        {:else}
          {$_('no_files_found')}
        {/if}
      </div>
    </Group>
  </div>
</div>

<style lang="scss">
  .wrapper {
    display: flex;
    flex-direction: column;
    width: 100%;
  }

  header {
    display: flex;
    align-items: center;
    border-width: 0 0 1px 0;
    border-color: var(--sui-primary-border-color);
    padding: 0 16px;
    height: 40px;
    background-color: var(--sui-tertiary-background-color);

    h2 {
      font-size: var(--sui-font-size-x-large);
    }
  }

  .results {
    flex: auto;
    display: flex;
    gap: 16px;
    overflow: hidden;
    padding: 16px;
    height: 100%;

    & > :global(.group) {
      flex: auto;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      width: 50%;
      height: 100%;
    }

    h3 {
      flex: none;
      margin: 0 0 8px;
      color: var(--sui-secondary-foreground-color);
      font-size: var(--sui-font-size-large);

      & + div {
        overflow: auto;
        flex: auto;
      }
    }
  }
</style>
