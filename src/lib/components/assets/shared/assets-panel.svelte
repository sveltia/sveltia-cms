<script>
  import { Option } from '@sveltia/ui';
  import { createEventDispatcher } from 'svelte';
  import { _ } from 'svelte-i18n';
  import SimpleImageGrid from '$lib/components/assets/shared/simple-image-grid.svelte';
  import EmptyState from '$lib/components/common/empty-state.svelte';
  import Image from '$lib/components/common/image.svelte';
  import Video from '$lib/components/common/video.svelte';
  import { selectAssetsView } from '$lib/services/contents/editor';

  const dispatch = createEventDispatcher();

  /**
   * @type {Asset[]}
   */
  export let assets = [];
  export let searchTerms = '';

  $: filteredAssets = searchTerms
    ? assets.filter(({ name }) => name.toLowerCase().includes(searchTerms.toLowerCase()))
    : assets;
</script>

{#if filteredAssets.length}
  <div class="grid-wrapper">
    <SimpleImageGrid
      viewType={$selectAssetsView?.type}
      on:change={(event) => {
        dispatch('select', {
          asset: assets.find(({ sha }) => sha === /** @type {CustomEvent} */ (event).detail.value),
        });
      }}
    >
      {#each filteredAssets as asset (asset.path)}
        <Option value={asset.sha}>
          {#if asset.kind === 'image'}
            <Image {asset} variant="tile" />
          {/if}
          {#if asset.kind === 'video'}
            <Video {asset} variant="tile" />
          {/if}
          <span class="name">{asset.name}</span>
        </Option>
      {/each}
    </SimpleImageGrid>
  </div>
{:else}
  <EmptyState>
    <span>{$_('no_files_found')}</span>
  </EmptyState>
{/if}

<style lang="scss">
  .grid-wrapper {
    display: contents;
  }
</style>
