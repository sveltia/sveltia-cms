<!--
  @component
  Container of the asset list, shared by repository folders and external locations: a drop zone
  for uploads around a grid of asset groups, or an empty state with an upload button.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { EmptyState, GridBody, InfiniteScroll } from '@sveltia/ui';
  import { sleep } from '@sveltia/utils/misc';

  import DropZone from '$lib/components/assets/shared/drop-zone.svelte';
  import ListContainer from '$lib/components/common/list-container.svelte';
  import ListingGrid from '$lib/components/common/listing-grid.svelte';

  /**
   * @import { Snippet } from 'svelte';
   * @import { Asset, ExternalAsset, ViewType } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {Record<string, (Asset | ExternalAsset)[]>} groups Assets to be listed, grouped by
   * label. A group labelled `*` has no caption.
   * @property {string} itemKey Property of an asset that identifies it in the list.
   * @property {number} totalCount Number of listed assets before any filter is applied, for
   * `aria-rowcount`.
   * @property {ViewType} viewType View type.
   * @property {boolean} uploadDisabled Whether uploads are disabled for the location.
   * @property {(files: File[]) => void} onDrop Called with the files dropped on the list.
   * @property {Snippet<[any, number]>} renderItem Renders a listed asset given the asset and its
   * index.
   * @property {Snippet} [emptyAction] Upload button shown in the empty state, unless uploads are
   * disabled.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    groups,
    itemKey,
    totalCount,
    viewType,
    uploadDisabled,
    onDrop,
    renderItem,
    emptyAction = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  /** Whether any asset is left to show once the filter has been applied. */
  const hasAssets = $derived(Object.values(groups).some((assets) => assets.length));
</script>

<ListContainer aria-label={_('asset_list')}>
  <DropZone
    disabled={uploadDisabled}
    multiple={true}
    onDrop={({ files }) => {
      onDrop(files);
    }}
  >
    {#if hasAssets}
      <ListingGrid id="asset-list" {viewType} aria-label={_('assets')} aria-rowcount={totalCount}>
        {#each Object.entries(groups) as [name, assets] (name)}
          {#await sleep() then}
            <GridBody label={name !== '*' ? name : undefined}>
              <InfiniteScroll items={assets} {itemKey} {renderItem} />
            </GridBody>
          {/await}
        {/each}
      </ListingGrid>
    {:else}
      <EmptyState>
        <span role="none">{_('no_files_found')}</span>
        {#if !uploadDisabled}
          {@render emptyAction?.()}
        {/if}
      </EmptyState>
    {/if}
  </DropZone>
</ListContainer>
