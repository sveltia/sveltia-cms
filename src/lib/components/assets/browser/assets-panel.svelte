<script>
  import { EmptyState, InfiniteScroll, Option, TruncatedText } from '@sveltia/ui';
  import { sleep } from '@sveltia/utils/misc';
  import { stripSlashes } from '@sveltia/utils/string';
  import equal from 'fast-deep-equal';
  import DOMPurify from 'isomorphic-dompurify';
  import { _ } from 'svelte-i18n';

  import SimpleImageGrid from '$lib/components/assets/browser/simple-image-grid.svelte';
  import AssetPreview from '$lib/components/assets/shared/asset-preview.svelte';
  import { normalize } from '$lib/services/search/util';
  import { isSmallScreen } from '$lib/services/user/env';

  /**
   * @import { Asset, SelectedResource, ViewType } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {Asset[]} [assets] Asset list.
   * @property {SelectedResource} [selectedResource] Selected resource.
   * @property {ViewType} [viewType] View type.
   * @property {string} [searchTerms] Search terms for filtering assets.
   * @property {string} [basePath] Path to an asset folder, if any folder is selected.
   * @property {string} [gridId] The `id` attribute of the inner listbox.
   * @property {boolean} [checkerboard] Whether to show a checkerboard background below a
   * transparent image.
   * @property {(detail: { asset: Asset }) => void} [onSelect] Custom `select` event handler.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    assets = [],
    selectedResource = $bindable(),
    viewType = 'grid',
    searchTerms = '',
    basePath = undefined,
    gridId = undefined,
    checkerboard = false,
    onSelect = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  const filteredAssets = $derived(
    searchTerms ? assets.filter(({ name }) => normalize(name).includes(searchTerms)) : assets,
  );
</script>

{#snippet getLabel(/** @type {string} */ str)}
  <!-- Allow to line-break after a hyphen, underscore and dot -->
  {@html DOMPurify.sanitize(str.replace(/([-_.])/g, '$1<wbr>'), { ALLOWED_TAGS: ['wbr'] })}
{/snippet}

{#if filteredAssets.length}
  <div role="none" class="grid-wrapper">
    <SimpleImageGrid
      {gridId}
      {viewType}
      showTitle={true}
      onChange={({ value }) => {
        const asset = /** @type {Asset} */ (assets.find(({ path }) => path === value));

        selectedResource = { asset };
        onSelect?.({ asset });
      }}
    >
      <InfiniteScroll items={filteredAssets} itemKey="path">
        {#snippet renderItem(/** @type {Asset} */ asset)}
          {#await sleep() then}
            {@const { kind, name, path, unsaved, folder } = asset}
            <!-- Show asset path relative to the base folder, or just file name -->
            {@const relPath =
              basePath && !folder.entryRelative ? stripSlashes(path.replace(basePath, '')) : name}
            {@const pathArray = relPath.split('/')}
            <Option label="" value={path} selected={equal(asset, selectedResource?.asset)}>
              {#snippet checkIcon()}
                <!-- Remove check icon -->
              {/snippet}
              {#if viewType === 'grid' && unsaved}
                <div role="none" class="unsaved">{$_('assets_dialog.unsaved')}</div>
              {/if}
              <AssetPreview {kind} {asset} variant="tile" {checkerboard} />
              {#if !$isSmallScreen || viewType === 'list'}
                <span role="none" class="name">
                  <TruncatedText lines={2}>
                    {#each pathArray as segment, index}
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
            </Option>
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
          [role='option'] {
            position: relative;
          }

          .unsaved {
            position: absolute;
            inset: 4px 4px auto auto;
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
