<svelte:options runes={true} />

<script>
  import { GridCell, GridRow } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import EmptyState from '$lib/components/common/empty-state.svelte';
  import InfiniteScroll from '$lib/components/common/infinite-scroll.svelte';
  import ListContainer from '$lib/components/common/list-container.svelte';
  import ListingGrid from '$lib/components/common/listing-grid.svelte';
  import { goto } from '$lib/services/app/navigation';
  import { selectedCollection } from '$lib/services/contents/collection';
</script>

<ListContainer aria-label={$_('file_list')}>
  {#if $selectedCollection?.files?.length}
    <ListingGrid
      viewType="list"
      aria-label={$_('files')}
      aria-rowcount={$selectedCollection.files.length}
    >
      <InfiniteScroll items={$selectedCollection.files} itemKey="name">
        {#snippet renderItem(/** @type {RawCollectionFile} */ { name, label })}
          <GridRow
            onclick={() => {
              goto(`/collections/${$selectedCollection?.name}/entries/${name}`);
            }}
          >
            <GridCell class="title">
              {label || name}
            </GridCell>
          </GridRow>
        {/snippet}
      </InfiniteScroll>
    </ListingGrid>
  {:else}
    <EmptyState>
      <span role="none">{$_('no_files_in_collection')}</span>
    </EmptyState>
  {/if}
</ListContainer>
