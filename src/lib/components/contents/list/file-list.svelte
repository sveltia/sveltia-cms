<script>
  import { _ } from '@sveltia/i18n';
  import { EmptyState, GridCell, GridRow, Icon, InfiniteScroll, TruncatedText } from '@sveltia/ui';

  import ListContainer from '$lib/components/common/list-container.svelte';
  import ListingGrid from '$lib/components/common/listing-grid.svelte';
  import ListPreviewLink from '$lib/components/contents/list/list-preview-link.svelte';
  import StatusBadge from '$lib/components/workflow/status-badge.svelte';
  import { goto } from '$lib/services/app/navigation';
  import { selectedCollection } from '$lib/services/contents/collection';
  import { getCollectionFile } from '$lib/services/contents/collection/files';
  import { isValidCollectionFile } from '$lib/services/contents/collection/predicates';
  import { getEntryEditorPath } from '$lib/services/contents/editor/route';
  import { getCollectionFileSummary } from '$lib/services/contents/entry/summary';
  import { unpublishedEntries } from '$lib/services/workflow';
  import { getEntryStage } from '$lib/services/workflow/stages';

  /**
   * @import { CollectionFile } from '$lib/types/public';
   * @import {
   * InternalFileCollection,
   * UnpublishedEntry,
   * WorkflowStatus,
   * } from '$lib/types/private';
   */

  const files = $derived(
    /** @type {InternalFileCollection} */ (selectedCollection.current)?.files.filter(
      isValidCollectionFile,
    ) ?? [],
  );

  /**
   * Unpublished entry and Editorial Workflow stage of each file that has an open pull request,
   * keyed by file name. A file collection needs no Unpublished/Published sections like an entry
   * collection, because every file is published from the start and can only be updated, never
   * added or removed.
   * @type {Record<string, { entry: UnpublishedEntry, status: WorkflowStatus }>}
   */
  const unpublishedFiles = $derived(
    Object.fromEntries(
      unpublishedEntries.current
        .filter(({ workflow }) => workflow.collectionName === selectedCollection.current?.name)
        .map((entry) => [
          entry.workflow.fileName,
          { entry, status: getEntryStage(entry, selectedCollection.current) },
        ]),
    ),
  );
</script>

<ListContainer aria-label={_('file_list')}>
  {#if files?.length}
    <ListingGrid viewType="list" aria-label={_('files')} aria-rowcount={files.length}>
      <InfiniteScroll items={files} itemKey="name">
        {#snippet renderItem(/** @type {CollectionFile} */ { name, label, icon })}
          <!-- HTML, as the summary can contain Markdown, like an entry collection’s -->
          {@const summary = getCollectionFileSummary(
            /** @type {InternalFileCollection} */ (selectedCollection.current),
            name,
          )}
          <GridRow
            onclick={() => {
              goto(getEntryEditorPath(`${selectedCollection.current?.name}`, name), {
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
                  {#if summary !== undefined}
                    <bdi>{@html summary}</bdi>
                  {:else}
                    {label || name}
                  {/if}
                </TruncatedText>
              </div>
            </GridCell>
            <GridCell class="status">
              <div role="none" class="status-items">
                {#if unpublishedFiles[name]}
                  {@const collection = /** @type {InternalFileCollection} */ (
                    selectedCollection.current
                  )}
                  <ListPreviewLink
                    {collection}
                    entry={unpublishedFiles[name].entry}
                    collectionFile={getCollectionFile(collection, name)}
                  />
                  <StatusBadge status={unpublishedFiles[name].status} />
                {/if}
              </div>
            </GridCell>
          </GridRow>
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
