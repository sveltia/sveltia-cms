<script>
  import { EmptyState, GridCell, GridRow, Icon, InfiniteScroll, TruncatedText } from '@sveltia/ui';
  import { sleep } from '@sveltia/utils/misc';
  import { _ } from 'svelte-i18n';
  import ListContainer from '$lib/components/common/list-container.svelte';
  import ListingGrid from '$lib/components/common/listing-grid.svelte';
  import { goto } from '$lib/services/app/navigation';
  import { selectedCollection } from '$lib/services/contents/collection';

  /**
   * @import { CollectionFile } from '$lib/types/public';
   */
</script>

<ListContainer aria-label={$_('file_list')}>
  {#if $selectedCollection?.files?.length}
    <ListingGrid
      viewType="list"
      aria-label={$_('files')}
      aria-rowcount={$selectedCollection.files.length}
    >
      <InfiniteScroll items={$selectedCollection.files} itemKey="name">
        {#snippet renderItem(/** @type {CollectionFile} */ { name, label, icon })}
          {#await sleep() then}
            <GridRow
              onclick={() => {
                goto(`/collections/${$selectedCollection.name}/entries/${name}`, {
                  transitionType: 'forwards',
                });
              }}
            >
              <GridCell class="title">
                <div role="none" class="label">
                  {#if icon}
                    <Icon name={icon} />
                  {/if}
                  <TruncatedText lines={2}>
                    {label || name}
                  </TruncatedText>
                </div>
              </GridCell>
            </GridRow>
          {/await}
        {/snippet}
      </InfiniteScroll>
    </ListingGrid>
  {:else}
    <EmptyState>
      <span role="none">{$_('no_files_in_collection')}</span>
    </EmptyState>
  {/if}
</ListContainer>

<style lang="scss">
  .label {
    display: flex;
    align-items: center;
    gap: 16px;

    :global(.icon) {
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--sui-control-medium-border-radius);
      width: var(--icon-size);
      height: var(--icon-size);
      background-color: var(--sui-secondary-background-color);
    }
  }
</style>
