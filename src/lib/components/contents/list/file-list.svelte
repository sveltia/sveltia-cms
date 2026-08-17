<script>
  import { _ } from '@sveltia/i18n';
  import { EmptyState, GridCell, GridRow, Icon, InfiniteScroll, TruncatedText } from '@sveltia/ui';
  import { sleep } from '@sveltia/utils/misc';

  import ListContainer from '$lib/components/common/list-container.svelte';
  import ListingGrid from '$lib/components/common/listing-grid.svelte';
  import StatusBadge from '$lib/components/workflow/status-badge.svelte';
  import { goto } from '$lib/services/app/navigation';
  import { selectedCollection } from '$lib/services/contents/collection';
  import { isValidCollectionFile } from '$lib/services/contents/collection/files';
  import { unpublishedEntries } from '$lib/services/workflow';

  /**
   * @import { CollectionFile } from '$lib/types/public';
   * @import { InternalFileCollection, WorkflowStatus } from '$lib/types/private';
   */

  const files = $derived(
    /** @type {InternalFileCollection} */ ($selectedCollection)?.files.filter(
      isValidCollectionFile,
    ) ?? [],
  );

  /**
   * Editorial Workflow status of each file that has an open pull request, keyed by file name. A
   * file collection needs no Unpublished/Published sections like an entry collection, because every
   * file is published from the start and can only be updated, never added or removed.
   * @type {Record<string, WorkflowStatus>}
   */
  const statuses = $derived(
    Object.fromEntries(
      $unpublishedEntries
        .filter(({ workflow }) => workflow.collectionName === $selectedCollection?.name)
        .map(({ workflow }) => [workflow.fileName, workflow.status]),
    ),
  );
</script>

<ListContainer aria-label={_('file_list')}>
  {#if files?.length}
    <ListingGrid viewType="list" aria-label={_('files')} aria-rowcount={files.length}>
      <InfiniteScroll items={files} itemKey="name">
        {#snippet renderItem(/** @type {CollectionFile} */ { name, label, icon })}
          {#await sleep() then}
            <GridRow
              onclick={() => {
                goto(`/collections/${$selectedCollection?.name}/entries/${name}`, {
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
              <GridCell class="status">
                {#if statuses[name]}
                  <StatusBadge status={statuses[name]} />
                {/if}
              </GridCell>
            </GridRow>
          {/await}
        {/snippet}
      </InfiniteScroll>
    </ListingGrid>
  {:else}
    <EmptyState>
      <span role="none">{_('no_files_in_collection')}</span>
    </EmptyState>
  {/if}
</ListContainer>

<style>
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
