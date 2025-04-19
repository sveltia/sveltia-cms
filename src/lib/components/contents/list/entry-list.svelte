<script>
  import { EmptyState, GridBody, InfiniteScroll } from '@sveltia/ui';
  import { sleep } from '@sveltia/utils/misc';
  import { _ } from 'svelte-i18n';
  import ListContainer from '$lib/components/common/list-container.svelte';
  import ListingGrid from '$lib/components/common/listing-grid.svelte';
  import EntryListItem from '$lib/components/contents/list/entry-list-item.svelte';
  import CreateEntryButton from '$lib/components/contents/toolbar/create-entry-button.svelte';
  import { selectedCollection } from '$lib/services/contents/collection';
  import { currentView, entryGroups, listedEntries } from '$lib/services/contents/collection/view';

  /**
   * @import { Entry, EntryCollection } from '$lib/types/private';
   */

  const collection = $derived(/** @type {EntryCollection | undefined} */ ($selectedCollection));
  const viewType = $derived($currentView.type);
  const allEntries = $derived($entryGroups.map(({ entries }) => entries).flat(1));
</script>

<ListContainer aria-label={collection?.files ? $_('file_list') : $_('entry_list')}>
  {#if collection}
    {#if allEntries.length}
      {@const { defaultLocale } = collection._i18n}
      <ListingGrid
        {viewType}
        id="entry-list"
        aria-label={$_('entries')}
        aria-rowcount={$listedEntries.length}
      >
        {#each $entryGroups as { name, entries } (name)}
          {#await sleep() then}
            <!-- @todo Implement custom table column option that can replace summary template -->
            <GridBody label={name !== '*' ? name : undefined}>
              <InfiniteScroll
                items={entries.filter(
                  ({ locales }) => !!(locales[defaultLocale] ?? Object.values(locales)[0])?.content,
                )}
                itemKey="id"
              >
                {#snippet renderItem(/** @type {Entry} */ entry)}
                  {#await sleep() then}
                    <EntryListItem {collection} {entry} {viewType} />
                  {/await}
                {/snippet}
              </InfiniteScroll>
            </GridBody>
          {/await}
        {/each}
      </ListingGrid>
    {:else if $listedEntries.length}
      <EmptyState>
        <span role="none">{$_('no_entries_found')}</span>
      </EmptyState>
    {:else}
      <EmptyState>
        <span role="none">{$_('no_entries_created')}</span>
        <CreateEntryButton collectionName={collection.name} label={$_('create_new_entry')} />
      </EmptyState>
    {/if}
  {:else}
    <EmptyState>
      <span role="none">{$_('collection_not_found')}</span>
    </EmptyState>
  {/if}
</ListContainer>
