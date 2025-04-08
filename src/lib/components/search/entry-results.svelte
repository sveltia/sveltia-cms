<script>
  import { Group } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import EmptyState from '$lib/components/common/empty-state.svelte';
  import InfiniteScroll from '$lib/components/common/infinite-scroll.svelte';
  import ListingGrid from '$lib/components/common/listing-grid.svelte';
  import EntryResultItem from '$lib/components/search/entry-result-item.svelte';
  import { searchResults, searchTerms } from '$lib/services/search';

  /**
   * @import { Entry } from '$lib/types/private';
   */
</script>

<Group aria-labelledby="search-results-entries">
  <h3 role="none" id="search-results-entries">{$_('entries')}</h3>
  <div role="none">
    {#if $searchResults.entries.length}
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
    {:else if $searchTerms}
      <EmptyState>
        <span role="none">{$_('no_entries_found')}</span>
      </EmptyState>
    {/if}
  </div>
</Group>
