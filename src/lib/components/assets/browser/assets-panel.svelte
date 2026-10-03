<script>
  import { _ } from '@sveltia/i18n';
  import { EmptyState, InfiniteScroll } from '@sveltia/ui';
  import { sleep } from '@sveltia/utils/misc';
  import { stripSlashes } from '@sveltia/utils/string';

  import AssetPath from '$lib/components/assets/browser/asset-path.svelte';
  import SimpleImageGridItem from '$lib/components/assets/browser/simple-image-grid-item.svelte';
  import SimpleImageGrid from '$lib/components/assets/browser/simple-image-grid.svelte';
  import SubfolderStrip from '$lib/components/assets/browser/subfolder-strip.svelte';
  import AssetPreview from '$lib/components/assets/shared/asset-preview.svelte';
  import { getAssetKey } from '$lib/services/assets';
  import { getNormalizedValueCache, hasAllMatches, tokenize } from '$lib/services/search/util';
  import { env } from '$lib/services/user/env.svelte';

  /**
   * @import {
   * Asset,
   * AssetSubfolder,
   * MediaLibraryAssetKind,
   * SelectedResource,
   * ViewType,
   * } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {boolean} [multiple] Whether to allow selecting multiple assets.
   * @property {MediaLibraryAssetKind} [kind] Kind of the assets being picked, which names the
   * list: images, or files of any kind if `undefined`.
   * @property {Asset[]} [assets] Asset list.
   * @property {ViewType} [viewType] View type.
   * @property {string} [searchTerms] Search terms for filtering assets.
   * @property {string} [basePath] Path to an asset folder, if any folder is selected.
   * @property {string} [gridId] The `id` attribute of the inner listbox.
   * @property {boolean} [checkerboard] Whether to show a checkerboard background below a
   * transparent image.
   * @property {string} [emptyMessage] Message shown when there is nothing to list, in place of the
   * default “No files found” message.
   * @property {SelectedResource[]} [selectedResources] Selected resources.
   * @property {AssetSubfolder[]} [subfolders] Subfolders of the folder being browsed, listed ahead
   * of the assets.
   * @property {(detail: { asset: Asset }) => void} [onSelect] Custom `select` event handler.
   * @property {(subfolder: AssetSubfolder) => void} [onOpenSubfolder] Called when a subfolder is
   * opened.
   * @property {string[]} [selectedSubfolderPaths] Paths of the selected subfolders.
   * @property {(subfolder: AssetSubfolder, selected: boolean) => void} [onSelectSubfolder] Called
   * with a subfolder and whether it’s now selected, when a folder is to be picked.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    multiple = false,
    kind = undefined,
    assets = [],
    viewType = 'grid',
    searchTerms = '',
    basePath = undefined,
    gridId = undefined,
    checkerboard = false,
    emptyMessage = undefined,
    selectedResources = $bindable([]),
    subfolders = [],
    onSelect = undefined,
    onOpenSubfolder = undefined,
    selectedSubfolderPaths = [],
    onSelectSubfolder = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  // Split the search terms into individual words for filtering purposes
  const tokens = $derived(tokenize(searchTerms));

  // The items are built separately from the filtering, so typing a search term reuses them instead
  // of creating a new object for every asset. Each item wraps the asset rather than copying it, so
  // the preview and the selection get the original asset object
  /** @type {{ asset: Asset, relPath: string, key: string }[]} */
  const listedItems = $derived(
    assets.map((asset) => {
      const { folder, name, path } = asset;

      // Compute the relative path for display and filtering purposes. If the asset is in a folder,
      // we want to show the path relative to that folder. If the asset is not in a folder, we just
      // show the file name.
      const relPath =
        basePath && !folder.entryRelative ? stripSlashes(path.replace(basePath, '')) : name;

      // An unsaved asset can share a path with the saved asset it’s going to overwrite, so each
      // item is identified by a unique key instead, avoiding Svelte `each` key conflicts
      return { asset, relPath, key: getAssetKey(asset) };
    }),
  );

  const filteredItems = $derived(
    tokens.length
      ? // Filter assets by search terms in the relative path, keeping each normalized path for the
        // next keystroke
        listedItems.filter((item) =>
          hasAllMatches({
            value: item.relPath,
            tokens,
            normalizedValueCache: getNormalizedValueCache(item),
          }),
        )
      : listedItems,
  );

  /**
   * Keys of the selected assets, built once per selection change so that each listed item can check
   * its own selection without going through the whole selection.
   */
  const selectedAssetKeys = $derived(
    new Set(selectedResources.flatMap(({ asset }) => (asset ? [getAssetKey(asset)] : []))),
  );

  /**
   * Check if the given asset is already selected.
   * @param {Asset} asset The asset to check.
   * @returns {boolean} `true` if the asset is selected, `false` otherwise.
   */
  const isSelected = (asset) => selectedAssetKeys.has(getAssetKey(asset));

  /**
   * Handle selection change of an asset.
   * @param {Asset} asset The asset whose selection changed.
   * @param {boolean} selected `true` if the asset is now selected, `false` otherwise.
   */
  const onSelectionChange = (asset, selected) => {
    const key = getAssetKey(asset);

    const otherResources = selectedResources.filter(
      (r) => !r.asset || getAssetKey(r.asset) !== key,
    );

    if (selected) {
      selectedResources = [...otherResources, { asset }];
      onSelect?.({ asset });
    } else {
      selectedResources = otherResources;
    }
  };
</script>

{#if filteredItems.length || subfolders.length}
  <div role="none" class="grid-wrapper">
    {#if subfolders.length}
      <SubfolderStrip
        {subfolders}
        {viewType}
        {multiple}
        onOpen={onOpenSubfolder}
        selectedPaths={selectedSubfolderPaths}
        onSelect={onSelectSubfolder}
      />
    {/if}
    <!-- An empty list box would only be a stop for the Tab key, with nothing to move through -->
    {#if filteredItems.length}
      <SimpleImageGrid
        {multiple}
        {gridId}
        {viewType}
        ariaLabel={_(`assets_dialog.available_${kind === 'image' ? 'images' : 'files'}`)}
      >
        <InfiniteScroll items={filteredItems} itemKey="key">
          {#snippet renderItem(/** @type {{ asset: Asset, relPath: string, key: string }} */ item)}
            {#await sleep() then}
              {@const { asset, key, relPath } = item}
              {@const { kind: assetKind, unsaved } = asset}
              <SimpleImageGridItem
                value={key}
                ariaLabel={relPath}
                {viewType}
                {multiple}
                selected={isSelected(asset)}
                onChange={({ detail: { selected } }) => {
                  onSelectionChange(asset, selected);
                }}
              >
                {#if viewType === 'grid' && unsaved}
                  <div role="none" class="unsaved">{_('assets_dialog.unsaved')}</div>
                {/if}
                <AssetPreview
                  kind={assetKind}
                  {asset}
                  alt={relPath}
                  variant="tile"
                  {checkerboard}
                />
                {#if !env.isSmallScreen || viewType === 'list'}
                  <AssetPath path={relPath}>
                    {#if viewType === 'list' && unsaved}
                      <div role="none" class="unsaved">{_('assets_dialog.unsaved')}</div>
                    {/if}
                  </AssetPath>
                {/if}
              </SimpleImageGridItem>
            {/await}
          {/snippet}
        </InfiniteScroll>
      </SimpleImageGrid>
    {/if}
  </div>
{:else}
  <EmptyState>
    <span role="none">{emptyMessage ?? _('no_files_found')}</span>
  </EmptyState>
{/if}

<style>
  .grid-wrapper {
    overflow-y: auto;
    height: 100%;

    :global {
      [role='listbox'] {
        background-color: transparent;

        &.grid {
          .unsaved {
            position: absolute;
            inset-block-start: 8px;
            inset-inline-end: 8px;
            z-index: 1;
          }
        }

        &.list {
          .name {
            display: flex;
            gap: 8px;
            align-items: center;
            justify-content: space-between;

            /* `Option` pins button descendants to `flex: none`, so a long name can’t shrink */
            .truncated-text {
              flex: auto;
              min-width: 0;
            }
          }
        }
      }
    }
  }

  .unsaved {
    display: flex;
    justify-content: center;
    align-items: center;
    border-color: var(--sui-info-border-color);
    border-radius: 4px;
    padding: 2px 6px;
    color: var(--sui-info-foreground-color);
    background-color: var(--sui-info-background-color);
    font-size: var(--sui-font-size-small);
  }
</style>
