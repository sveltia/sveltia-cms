<script>
  import { _ } from '@sveltia/i18n';
  import { EmptyState, GridBody, InfiniteScroll } from '@sveltia/ui';
  import { sleep } from '@sveltia/utils/misc';
  import { untrack } from 'svelte';

  import ListContainer from '$lib/components/common/list-container.svelte';
  import ListingGrid from '$lib/components/common/listing-grid.svelte';
  import EntryBulkEditList from '$lib/components/contents/list/entry-bulk-edit-list.svelte';
  import EntryListItem from '$lib/components/contents/list/entry-list-item.svelte';
  import EntryReorderList from '$lib/components/contents/list/entry-reorder-list.svelte';
  import EntryTableHead from '$lib/components/contents/list/entry-table-head.svelte';
  import CreateEntryButton from '$lib/components/contents/toolbar/create-entry-button.svelte';
  import { getGroupLabel, isGroupCollapsed, setGroupCollapsed } from '$lib/services/common/view';
  import { selectedCollection } from '$lib/services/contents/collection';
  import {
    bulkEditing,
    entryGroups,
    listedEntries,
    listedUnpublishedEntries,
    reordering,
  } from '$lib/services/contents/collection/view';
  import {
    currentView,
    getEntryOrderKey,
    getEntryViewType,
    getEntryViewTypes,
  } from '$lib/services/contents/collection/view/settings';
  import { sortKeys } from '$lib/services/contents/collection/view/sort-keys';
  import { getTableColumns } from '$lib/services/contents/collection/view/table';
  import { env } from '$lib/services/user/env.svelte';
  import { openAuthoring } from '$lib/services/workflow/open-authoring';

  /**
   * @import { Entry, EntryTableColumn, InternalEntryCollection } from '$lib/types/private';
   */

  const collection = $derived(
    /** @type {InternalEntryCollection | undefined} */ (selectedCollection.current),
  );
  const viewType = $derived(
    getEntryViewType({
      type: currentView.current.type,
      types: getEntryViewTypes(collection),
      isLargeScreen: env.isLargeScreen,
      reordering: reordering.current,
    }),
  );
  /** @type {EntryTableColumn[]} */
  const columns = $derived(
    viewType === 'table' && collection
      ? getTableColumns({ collection, sortKeys: sortKeys.current.map(({ key }) => key) })
      : [],
  );
  const allEntries = $derived(entryGroups.current.flatMap(({ entries }) => entries));
  // Changes when the entries are sorted, filtered or grouped differently, which starts the list
  // again from the top: the rows are rendered anew a chunk at a time, rather than every row loaded
  // so far being rendered at once in the new order, and the list is scrolled back to the top
  const orderKey = $derived(getEntryOrderKey(currentView.current));

  /**
   * Get a promise that defers rendering the rows of a group by a tick, so the toolbar stays
   * responsive while the groups are rendered anew, e.g. after a sort. The table view renders them
   * right away instead: waiting would leave the table with its header alone for a moment, and its
   * columns, sized to fit the cells, would collapse and spring back. The view type is read without
   * being tracked, so switching views later doesn’t render the groups anew and lose the rows loaded
   * so far.
   * @returns {Promise<void> | undefined} Promise, or `undefined` to render right away.
   */
  const deferRows = () => (untrack(() => viewType) === 'table' ? undefined : sleep());
</script>

{#snippet group(
  /** @type {InternalEntryCollection} */ _collection,
  /** @type {string} */ name,
  /** @type {Entry[]} */ entries,
)}
  {@const { defaultLocale } = _collection._i18n}
  <GridBody
    label={name !== '*'
      ? getGroupLabel(name)
      : listedUnpublishedEntries.current.length
        ? _('workflow.published_entries')
        : undefined}
    collapsible={name !== '*'}
    expanded={!isGroupCollapsed(currentView.current, name)}
    onChange={({ detail: { expanded } }) => {
      currentView.current = setGroupCollapsed(currentView.current, name, !expanded);
    }}
  >
    <InfiniteScroll
      items={entries.filter(
        ({ locales }) => !!(locales[defaultLocale] ?? Object.values(locales)[0])?.content,
      )}
      itemKey="id"
    >
      {#snippet renderItem(/** @type {Entry} */ entry)}
        <EntryListItem collection={_collection} {entry} {viewType} {columns} />
      {/snippet}
    </InfiniteScroll>
  </GridBody>
{/snippet}

<ListContainer aria-label={_('entry_list')}>
  {#if collection}
    {#if bulkEditing.current}
      <EntryBulkEditList {collection} />
    {:else if allEntries.length || listedUnpublishedEntries.current.length}
      <ListingGrid
        {viewType}
        id="entry-list"
        aria-label={_('entries')}
        scrollKey={orderKey}
        aria-rowcount={listedEntries.current.length +
          listedUnpublishedEntries.current.length +
          (viewType === 'table' ? 1 : 0)}
      >
        {#if reordering.current}
          <EntryReorderList {collection} {viewType} />
        {:else}
          {#if viewType === 'table'}
            <!-- The table view is only shown on a large screen, where the rows have checkboxes -->
            <EntryTableHead {collection} {columns} showCheckbox={!openAuthoring.current} />
          {/if}
          {#if listedUnpublishedEntries.current.length}
            <GridBody label={_('workflow.unpublished_entries')}>
              {#each listedUnpublishedEntries.current as entry (entry.id)}
                <EntryListItem {collection} {entry} {viewType} {columns} />
              {/each}
            </GridBody>
          {/if}
          {#key orderKey}
            {#each entryGroups.current as { name, entries } (name)}
              {#await deferRows() then}
                {@render group(collection, name, entries)}
              {/await}
            {/each}
          {/key}
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
