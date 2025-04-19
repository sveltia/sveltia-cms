<script>
  import { EmptyState, Group, InfiniteScroll } from '@sveltia/ui';
  import { sleep } from '@sveltia/utils/misc';
  import { _ } from 'svelte-i18n';
  import ListingGrid from '$lib/components/common/listing-grid.svelte';
  import EntryResultItem from '$lib/components/search/entry-result-item.svelte';
  import { announcedPageStatus } from '$lib/services/app/navigation';
  import { entrySearchResults, searchTerms } from '$lib/services/search';

  /**
   * @import { Entry } from '$lib/types/private';
   */

  $effect(() => {
    const entryCount = $entrySearchResults.length;

    $announcedPageStatus = $_('viewing_entry_search_results', {
      values: {
        terms: $searchTerms,
        entries:
          entryCount > 1
            ? $_('many_entries', { values: { count: entryCount } })
            : entryCount === 1
              ? $_('one_entry')
              : $_('no_entries'),
      },
    });
  });
</script>

<Group aria-labelledby="search-results-entries">
  <h3 role="none" id="search-results-entries">{$_('entries')}</h3>
  <div role="none">
    {#if $entrySearchResults.length}
      <ListingGrid
        viewType="list"
        aria-label={$_('entries')}
        aria-rowcount={$entrySearchResults.length}
      >
        {#key $searchTerms}
          <InfiniteScroll items={$entrySearchResults} itemKey="id">
            {#snippet renderItem(/** @type {Entry} */ entry)}
              {#await sleep() then}
                <EntryResultItem {entry} />
              {/await}
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
