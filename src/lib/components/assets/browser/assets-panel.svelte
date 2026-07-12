<script>
  import { _ } from '@sveltia/i18n';
  import { EmptyState, InfiniteScroll } from '@sveltia/ui';
  import { sleep } from '@sveltia/utils/misc';
  import { stripSlashes } from '@sveltia/utils/string';

  import AssetPath from '$lib/components/assets/browser/asset-path.svelte';
  import SimpleImageGridItem from '$lib/components/assets/browser/simple-image-grid-item.svelte';
  import SimpleImageGrid from '$lib/components/assets/browser/simple-image-grid.svelte';
  import AssetPreview from '$lib/components/assets/shared/asset-preview.svelte';
  import { normalize } from '$lib/services/search/util';
  import { env } from '$lib/services/user/env.svelte';

  /**
   * @import { Asset, SelectedResource, ViewType } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {boolean} [multiple] Whether to allow selecting multiple assets.
   * @property {Asset[]} [assets] Asset list.
   * @property {ViewType} [viewType] View type.
   * @property {string} [searchTerms] Search terms for filtering assets.
   * @property {string} [basePath] Path to an asset folder, if any folder is selected.
   * @property {string} [gridId] The `id` attribute of the inner listbox.
   * @property {boolean} [checkerboard] Whether to show a checkerboard background below a
   * transparent image.
   * @property {SelectedResource[]} [selectedResources] Selected resources.
   * @property {(detail: { asset: Asset }) => void} [onSelect] Custom `select` event handler.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    multiple = false,
    assets = [],
    viewType = 'grid',
    searchTerms = '',
    basePath = undefined,
    gridId = undefined,
    checkerboard = false,
    selectedResources = $bindable([]),
    onSelect = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  // Split the search terms into an array of individual terms for filtering purposes. If no search
  // terms are provided, use an empty array.
  const searchTermsArray = $derived(searchTerms ? searchTerms.split(/\s+/).filter(Boolean) : []);

  /** @type {(Asset & { relPath: string })[]} */
  const filteredAssets = $derived.by(() => {
    let _assets = assets.map((asset) => {
      const { folder, name, path } = asset;

      // Compute the relative path for display and filtering purposes. If the asset is in a folder,
      // we want to show the path relative to that folder. If the asset is not in a folder, we just
      // show the file name.
      const relPath =
        basePath && !folder.entryRelative ? stripSlashes(path.replace(basePath, '')) : name;

      return { ...asset, relPath };
    });

    if (searchTermsArray.length) {
      // Filter assets by search terms in the relative path
      _assets = _assets.filter(({ relPath }) =>
        searchTermsArray.every((term) => normalize(relPath).includes(term)),
      );
    }

    // Remove duplicates based on asset path to avoid Svelte key conflicts
    // @todo better handle duplicates at the source
    return _assets.filter(
      (asset, index, arr) => arr.findIndex((other) => other.path === asset.path) === index,
    );
  });

  /**
   * Check if the given asset is already selected.
   * @param {Asset} asset The asset to check.
   * @returns {boolean} `true` if the asset is selected, `false` otherwise.
   */
  const isSelected = (asset) => selectedResources.some((r) => r.asset?.path === asset.path);

  /**
   * Handle selection change of an asset.
   * @param {Asset} asset The asset whose selection changed.
   * @param {boolean} selected `true` if the asset is now selected, `false` otherwise.
   */
  const onSelectionChange = (asset, selected) => {
    const otherResources = selectedResources.filter((r) => r.asset?.path !== asset.path);

    if (selected) {
      selectedResources = [...otherResources, { asset }];
      onSelect?.({ asset });
    } else {
      selectedResources = otherResources;
    }
  };
</script>

{#if filteredAssets.length}
  <div role="none" class="grid-wrapper">
    <SimpleImageGrid {multiple} {gridId} {viewType}>
      <InfiniteScroll items={filteredAssets} itemKey="path">
        {#snippet renderItem(/** @type {Asset & { relPath: string }} */ asset)}
          {#await sleep() then}
            {@const { kind, unsaved, path, relPath } = asset}
            <SimpleImageGridItem
              value={path}
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
              <AssetPreview {kind} {asset} alt={relPath} variant="tile" {checkerboard} />
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
  </div>
{:else}
  <EmptyState>
    <span role="none">{_('no_files_found')}</span>
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
