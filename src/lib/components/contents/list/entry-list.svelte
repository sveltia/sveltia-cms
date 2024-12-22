<script>
  import { Button, GridBody, Icon } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import EmptyState from '$lib/components/common/empty-state.svelte';
  import InfiniteScroll from '$lib/components/common/infinite-scroll.svelte';
  import ListContainer from '$lib/components/common/list-container.svelte';
  import ListingGrid from '$lib/components/common/listing-grid.svelte';
  import EntryListItem from '$lib/components/contents/list/entry-list-item.svelte';
  import { goto } from '$lib/services/app/navigation';
  import { selectedCollection } from '$lib/services/contents/collection';
  import { currentView, entryGroups, listedEntries } from '$lib/services/contents/collection/view';

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
          <!-- @todo Implement custom table column option that can replace summary template -->
          <GridBody label={name !== '*' ? name : undefined}>
            <InfiniteScroll
              items={entries.filter(
                ({ locales }) => !!(locales[defaultLocale] ?? Object.values(locales)[0])?.content,
              )}
              itemKey="id"
            >
              {#snippet renderItem(/** @type {Entry} */ entry)}
                <EntryListItem {collection} {entry} {viewType} />
              {/snippet}
            </InfiniteScroll>
          </GridBody>
        {/each}
      </ListingGrid>
    {:else if $listedEntries.length}
      <EmptyState>
        <span role="none">{$_('no_entries_found')}</span>
      </EmptyState>
    {:else}
      <EmptyState>
        <span role="none">{$_('no_entries_created')}</span>
        <Button
          variant="primary"
          disabled={!collection.create}
          label={$_('create_new_entry')}
          onclick={() => {
            goto(`/collections/${collection?.name}/new`);
          }}
        >
          {#snippet startIcon()}
            <Icon name="edit" />
          {/snippet}
        </Button>
      </EmptyState>
    {/if}
  {:else}
    <EmptyState>
      <span role="none">{$_('collection_not_found')}</span>
    </EmptyState>
  {/if}
</ListContainer>
