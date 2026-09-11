<script>
  import { _ } from '@sveltia/i18n';
  import { EmptyState, GridBody, InfiniteScroll } from '@sveltia/ui';
  import { sleep } from '@sveltia/utils/misc';

  import ListContainer from '$lib/components/common/list-container.svelte';
  import ListingGrid from '$lib/components/common/listing-grid.svelte';
  import EntryListItem from '$lib/components/contents/list/entry-list-item.svelte';
  import EntryReorderList from '$lib/components/contents/list/entry-reorder-list.svelte';
  import CreateEntryButton from '$lib/components/contents/toolbar/create-entry-button.svelte';
  import { selectedCollection } from '$lib/services/contents/collection';
  import {
    currentView,
    entryGroups,
    listedEntries,
    listedUnpublishedEntries,
    reordering,
  } from '$lib/services/contents/collection/view';

  /**
   * @import { Entry, InternalEntryCollection } from '$lib/types/private';
   */

  const collection = $derived(
    /** @type {InternalEntryCollection | undefined} */ (selectedCollection.current),
  );
  const viewType = $derived(reordering.current ? 'list' : currentView.current.type);
  const allEntries = $derived(entryGroups.current.flatMap(({ entries }) => entries));
</script>

<ListContainer aria-label={_('entry_list')}>
  {#if collection}
    {#if allEntries.length || listedUnpublishedEntries.current.length}
      {@const { defaultLocale } = collection._i18n}
      <ListingGrid
        {viewType}
        id="entry-list"
        aria-label={_('entries')}
        aria-rowcount={listedEntries.current.length + listedUnpublishedEntries.current.length}
      >
        <!-- @todo Implement custom table column option that can replace summary template -->
        {#if reordering.current}
          <EntryReorderList {collection} {viewType} />
        {:else}
          {#if listedUnpublishedEntries.current.length}
            <GridBody label={_('workflow.unpublished_entries')}>
              {#each listedUnpublishedEntries.current as entry (entry.id)}
                <EntryListItem {collection} {entry} {viewType} />
              {/each}
            </GridBody>
          {/if}
          {#each entryGroups.current as { name, entries } (name)}
            {#await sleep() then}
              <GridBody
                label={name !== '*'
                  ? name
                  : listedUnpublishedEntries.current.length
                    ? _('workflow.published_entries')
                    : undefined}
              >
                <InfiniteScroll
                  items={entries.filter(
                    ({ locales }) =>
                      !!(locales[defaultLocale] ?? Object.values(locales)[0])?.content,
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
        {/if}
      </ListingGrid>
    {:else if listedEntries.current.length}
      <EmptyState>
        <span role="none">{_('no_entries_found')}</span>
      </EmptyState>
    {:else}
      <EmptyState>
        <span role="none">{_('no_entries_created')}</span>
        <CreateEntryButton collectionName={collection.name} label={_('create_new_entry')} />
      </EmptyState>
    {/if}
  {:else}
    <EmptyState>
      <span role="none">{_('collection_not_found')}</span>
    </EmptyState>
  {/if}
</ListContainer>
