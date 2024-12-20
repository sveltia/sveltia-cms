<script>
  import { Option } from '@sveltia/ui';
  import DOMPurify from 'isomorphic-dompurify';
  import { _ } from 'svelte-i18n';
  import AssetPreview from '$lib/components/assets/shared/asset-preview.svelte';
  import SimpleImageGrid from '$lib/components/assets/shared/simple-image-grid.svelte';
  import EmptyState from '$lib/components/common/empty-state.svelte';
  import InfiniteScroll from '$lib/components/common/infinite-scroll.svelte';
  import { normalize } from '$lib/services/search';

  /**
   * @typedef {object} Props
   * @property {Asset[]} [assets] - Asset list.
   * @property {ViewType} [viewType] - View type.
   * @property {string} [searchTerms] - Search terms for filtering assets.
   * @property {string} [gridId] - The `id` attribute of the inner listbox.
   * @property {boolean} [checkerboard] - Whether to show a checkerboard background below a
   * transparent image.
   * @property {(detail: { asset: Asset }) => void} [onSelect] - Custom `select` event handler.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    assets = [],
    viewType = 'grid',
    searchTerms = '',
    gridId = undefined,
    checkerboard = false,
    onSelect = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  const filteredAssets = $derived(
    searchTerms ? assets.filter(({ name }) => normalize(name).includes(searchTerms)) : assets,
  );
</script>

{#if filteredAssets.length}
  <div role="none" class="grid-wrapper">
    <SimpleImageGrid
      {gridId}
      {viewType}
      showTitle={true}
      onChange={({ value }) => {
        onSelect?.({ asset: /** @type {Asset} */ (assets.find(({ sha }) => sha === value)) });
      }}
    >
      <InfiniteScroll items={filteredAssets} itemKey="path">
        {#snippet renderItem(/** @type {Asset} */ asset)}
          {@const { sha, kind, name } = asset}
          <Option label="" value={sha}>
            <AssetPreview {kind} {asset} variant="tile" {checkerboard} />
            <span role="none" class="name">
              <!-- Allow to line-break after a hyphen, underscore and dot -->
              {@html DOMPurify.sanitize(name.replace(/([-_.])/g, '$1<wbr>'), {
                ALLOWED_TAGS: ['wbr'],
              })}
            </span>
          </Option>
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
  }
</style>
