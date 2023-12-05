<script>
  import { Option } from '@sveltia/ui';
  import DOMPurify from 'isomorphic-dompurify';
  import { createEventDispatcher } from 'svelte';
  import { _ } from 'svelte-i18n';
  import SimpleImageGrid from '$lib/components/assets/shared/simple-image-grid.svelte';
  import EmptyState from '$lib/components/common/empty-state.svelte';
  import Image from '$lib/components/common/image.svelte';
  import Video from '$lib/components/common/video.svelte';

  const dispatch = createEventDispatcher();

  /**
   * @type {Asset[]}
   */
  export let assets = [];
  /**
   * @type {ViewType}
   */
  export let viewType = 'grid';
  /**
   * @type {string}
   */
  export let searchTerms = '';
  /**
   * The `id` attribute of the inner listbox.
   * @type {string}
   */
  export let gridId = undefined;
  /**
   * Whether to show a checkerboard background below a transparent image.
   * @type {boolean}
   */
  export let checkerboard = false;

  $: filteredAssets = searchTerms
    ? assets.filter(({ name }) => name.toLowerCase().includes(searchTerms.toLowerCase()))
    : assets;
</script>

{#if filteredAssets.length}
  <div role="none" class="grid-wrapper">
    <SimpleImageGrid
      {gridId}
      {viewType}
      showTitle={true}
      on:change={(event) => {
        dispatch('select', {
          asset: assets.find(({ sha }) => sha === /** @type {CustomEvent} */ (event).detail.value),
        });
      }}
    >
      {#each filteredAssets as asset (asset.path)}
        <Option value={asset.sha}>
          {#if asset.kind === 'image'}
            <Image {asset} variant="tile" {checkerboard} />
          {/if}
          {#if asset.kind === 'video'}
            <Video {asset} variant="tile" />
          {/if}
          <span role="none" class="name">
            <!-- Allow to line-break after a hyphen, underscore and dot -->
            {@html DOMPurify.sanitize(asset.name.replace(/([-_.])/g, '$1<wbr>'), {
              ALLOWED_TAGS: ['wbr'],
            })}
          </span>
        </Option>
      {/each}
    </SimpleImageGrid>
  </div>
{:else}
  <EmptyState>
    <span role="none">{$_('no_files_found')}</span>
  </EmptyState>
{/if}

<style lang="scss">
  .grid-wrapper {
    display: contents;
  }
</style>
