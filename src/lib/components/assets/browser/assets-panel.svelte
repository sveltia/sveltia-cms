<script>
  import { EmptyState, InfiniteScroll, Option, TruncatedText } from '@sveltia/ui';
  import { sleep } from '@sveltia/utils/misc';
  import { stripSlashes } from '@sveltia/utils/string';
  import DOMPurify from 'isomorphic-dompurify';
  import { _ } from 'svelte-i18n';
  import { isSmallScreen } from '$lib/services/user/env';
  import { normalize } from '$lib/services/search';
  import AssetPreview from '$lib/components/assets/shared/asset-preview.svelte';
  import SimpleImageGrid from '$lib/components/assets/browser/simple-image-grid.svelte';

  /**
   * @import { Asset, ViewType } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {Asset[]} [assets] Asset list.
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
        onSelect?.({
          asset: /** @type {Asset} */ (assets.find(({ path }) => path === value)),
        });
      }}
    >
      <InfiniteScroll items={filteredAssets} itemKey="path">
        {#snippet renderItem(/** @type {Asset} */ asset)}
          {#await sleep(0) then}
            {@const { kind, name, path } = asset}
            <!-- Show asset path relative to the base folder, or just file name -->
            {@const relPath = basePath ? stripSlashes(path.replace(basePath, '')) : name}
            {@const pathArray = relPath.split('/')}
            <Option label="" value={path}>
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

    :global([role='listbox']) {
      background-color: transparent;
    }
  }

  .name {
    color: var(--sui-tertiary-foreground-color);

    strong {
      color: var(--sui-primary-foreground-color);
      font-weight: var(--sui-font-weight-normal);
    }
  }
</style>
