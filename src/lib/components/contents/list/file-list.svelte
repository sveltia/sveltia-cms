<script>
  import { _ } from '@sveltia/i18n';
  import { EmptyState, GridCell, GridRow, Icon, InfiniteScroll, TruncatedText } from '@sveltia/ui';

  import ListContainer from '$lib/components/common/list-container.svelte';
  import ListingGrid from '$lib/components/common/listing-grid.svelte';
  import EntryStatusCell from '$lib/components/contents/list/entry-status-cell.svelte';
  import { goto } from '$lib/services/app/navigation';
  import { selectedCollection } from '$lib/services/contents/collection';
  import {
    getCollectionFile,
    getCollectionFileEntry,
  } from '$lib/services/contents/collection/files';
  import { isValidCollectionFile } from '$lib/services/contents/collection/predicates';
  import { getEntryEditorPath } from '$lib/services/contents/editor/route';
  import { getCollectionFileSummary } from '$lib/services/contents/entry/summary';
  import { retainDeployPolling } from '$lib/services/deployments/poll';
  import { unpublishedEntries } from '$lib/services/workflow';

  /**
   * @import { CollectionFile } from '$lib/types/public';
   * @import { InternalFileCollection, UnpublishedEntry } from '$lib/types/private';
   */

  // The list is only shown for a file collection
  const collection = $derived(
    /** @type {InternalFileCollection | undefined} */ (selectedCollection.current),
  );
  const files = $derived(collection?.files.filter(isValidCollectionFile) ?? []);

  /**
   * Unpublished entry of each file that has an open pull request, keyed by file name. A file
   * collection needs no Unpublished/Published sections like an entry collection, because every
   * file is published from the start and can only be updated, never added or removed.
   * @type {Record<string, UnpublishedEntry>}
   */
  const unpublishedFiles = $derived(
    Object.fromEntries(
      unpublishedEntries.current
        .filter(({ workflow }) => workflow.collectionName === collection?.name)
        .map((entry) => [entry.workflow.fileName, entry]),
    ),
  );

  const hasUnpublishedFiles = $derived(Object.keys(unpublishedFiles).length > 0);

  // Keep the deploy state of the unpublished files up to date while they’re listed, so their
  // preview links turn from a spinner into a link once the build finishes. One hold covers every
  // row; the release function is returned synchronously, or the hold would leak
  $effect(() => (hasUnpublishedFiles ? retainDeployPolling() : undefined));
</script>

<ListContainer aria-label={_('file_list')}>
  {#if files.length && collection}
    <ListingGrid viewType="list" aria-label={_('files')} aria-rowcount={files.length}>
      <InfiniteScroll items={files} itemKey="name">
        {#snippet renderItem(/** @type {CollectionFile} */ { name, label, icon })}
          <!-- HTML, as the summary can contain Markdown, like an entry collection’s -->
          {@const summary = getCollectionFileSummary(collection, name)}
          <GridRow
            onclick={() => {
              goto(getEntryEditorPath(collection.name, name), {
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
            <EntryStatusCell
              {collection}
              subPath={name}
              entry={unpublishedFiles[name] ?? getCollectionFileEntry(collection.name, name)}
              collectionFile={getCollectionFile(collection, name)}
              showPreviewLink
            />
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
