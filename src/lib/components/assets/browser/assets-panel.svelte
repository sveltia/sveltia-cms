<script>
  import { EmptyState, InfiniteScroll, TruncatedText } from '@sveltia/ui';
  import { sleep } from '@sveltia/utils/misc';
  import { stripSlashes } from '@sveltia/utils/string';
  import equal from 'fast-deep-equal';
  import { sanitize } from 'isomorphic-dompurify';
  import { _ } from 'svelte-i18n';

  import SimpleImageGridItem from '$lib/components/assets/browser/simple-image-grid-item.svelte';
  import SimpleImageGrid from '$lib/components/assets/browser/simple-image-grid.svelte';
  import AssetPreview from '$lib/components/assets/shared/asset-preview.svelte';
  import { normalize } from '$lib/services/search/util';
  import { isSmallScreen } from '$lib/services/user/env';

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

  const filteredAssets = $derived(
    (searchTerms ? assets.filter(({ name }) => normalize(name).includes(searchTerms)) : assets)
      // Remove duplicates based on asset path to avoid Svelte key conflicts
      // @todo better handle duplicates at the source
      .filter((asset, index, arr) => arr.findIndex((other) => other.path === asset.path) === index),
  );

  /**
   * Check if the given asset is already selected.
   * @param {Asset} asset The asset to check.
   * @returns {boolean} `true` if the asset is selected, `false` otherwise.
   */
  const isSelected = (asset) => selectedResources.some((r) => equal(r.asset, asset));

  /**
   * Handle selection change of an asset.
   * @param {Asset} asset The asset whose selection changed.
   * @param {boolean} selected `true` if the asset is now selected, `false` otherwise.
   */
  const onSelectionChange = (asset, selected) => {
    const otherResources = selectedResources.filter((r) => !equal(r.asset, asset));

    if (selected) {
      selectedResources = [...otherResources, { asset }];
      onSelect?.({ asset });
    } else {
      selectedResources = otherResources;
    }
  };
</script>

{#snippet getLabel(/** @type {string} */ str)}
  <!-- Allow to line-break after a hyphen, underscore and dot -->
  {@html sanitize(str.replace(/([-_.])/g, '$1<wbr>'), { ALLOWED_TAGS: ['wbr'] })}
{/snippet}

{#if filteredAssets.length}
  <div role="none" class="grid-wrapper">
    <SimpleImageGrid {multiple} {gridId} {viewType} showTitle={true}>
      <InfiniteScroll items={filteredAssets} itemKey="path">
        {#snippet renderItem(/** @type {Asset} */ asset)}
          {#await sleep() then}
            {@const { kind, name, path, unsaved, folder } = asset}
            <!-- Show asset path relative to the base folder, or just file name -->
            {@const relPath =
              basePath && !folder.entryRelative ? stripSlashes(path.replace(basePath, '')) : name}
            {@const pathArray = relPath.split('/')}
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
                <div role="none" class="unsaved">{$_('assets_dialog.unsaved')}</div>
              {/if}
              <AssetPreview {kind} {asset} variant="tile" {checkerboard} />
              {#if !$isSmallScreen || viewType === 'list'}
                <span role="none" class="name">
                  <TruncatedText lines={2}>
                    {#each pathArray as segment, index (index)}
                      {#if index === pathArray.length - 1}
                        <!-- File name -->
                        <strong>{@render getLabel(segment)}</strong>
                      {:else}
                        <!-- Folder name -->
                        {@render getLabel(segment)}/
                      {/if}
                    {/each}
                  </TruncatedText>
                  {#if viewType === 'list' && unsaved}
                    <div role="none" class="unsaved">{$_('assets_dialog.unsaved')}</div>
                  {/if}
                </span>
              {/if}
            </SimpleImageGridItem>
          {/await}
        {/snippet}
      </InfiniteScroll>
    </SimpleImageGrid>
  </div>
{:else}
  <EmptyState>
    <span role="none">{$_('no_files_found')}</span>
  </EmptyState>
{/if}

<style lang="scss">
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

  .name {
    color: var(--sui-tertiary-foreground-color);

    strong {
      color: var(--sui-primary-foreground-color);
      font-weight: var(--sui-font-weight-normal);
    }
  }
</style>
