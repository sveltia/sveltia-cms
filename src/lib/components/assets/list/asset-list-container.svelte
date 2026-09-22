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
  import { currentView } from '$lib/services/assets/view/settings';
  import { getGroupLabel, isGroupCollapsed, setGroupCollapsed } from '$lib/services/common/view';

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
   * @property {() => void} [onBlankClick] Called when the empty area of the list, outside any row,
   * is clicked, which is how the focus is taken off an asset.
   * @property {Snippet<[any, number]>} renderItem Renders a listed asset given the asset and its
   * index.
   * @property {Snippet} [subfolders] Rows for the subfolders of a repository folder, listed ahead
   * of the asset groups.
   * @property {boolean} [hasSubfolders] Whether there is any subfolder to list, in which case the
   * grid is shown even when no asset is left to show.
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
    onBlankClick = undefined,
    renderItem,
    subfolders = undefined,
    hasSubfolders = false,
    emptyAction = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  /** Whether any asset is left to show once the filter has been applied. */
  const hasAssets = $derived(Object.values(groups).some((assets) => assets.length));
</script>

<ListContainer
  aria-label={_('asset_list')}
  onclick={(/** @type {MouseEvent} */ event) => {
    if (
      !(/** @type {HTMLElement} */ (event.target).closest('[role="row"], button, [role="menu"]'))
    ) {
      onBlankClick?.();
    }
  }}
>
  <DropZone
    disabled={uploadDisabled}
    multiple={true}
    onDrop={({ files }) => {
      onDrop(files);
    }}
  >
    {#if hasAssets || hasSubfolders}
      <ListingGrid id="asset-list" {viewType} aria-label={_('assets')} aria-rowcount={totalCount}>
        {#if hasSubfolders}
          <GridBody class="subfolders">
            {@render subfolders?.()}
          </GridBody>
        {/if}
        {#each Object.entries(groups) as [name, assets] (name)}
          {#await sleep() then}
            <GridBody
              label={name !== '*' ? getGroupLabel(name) : undefined}
              collapsible={name !== '*'}
              expanded={!isGroupCollapsed(currentView.current, name)}
              onChange={({ detail: { expanded } }) => {
                currentView.current = setGroupCollapsed(currentView.current, name, !expanded);
              }}
            >
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

<style>
  :global {
    /* Keep the compact folder tiles apart from the asset tiles below them */
    .grid-view .grid-body.subfolders:not(:last-child) {
      margin-bottom: 16px;
    }
  }
</style>
