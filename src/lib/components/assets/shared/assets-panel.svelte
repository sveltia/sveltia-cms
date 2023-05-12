<script>
  import { Option } from '@sveltia/ui';
  import { createEventDispatcher } from 'svelte';
  import { _ } from 'svelte-i18n';
  import SimpleImageGrid from '$lib/components/assets/shared/simple-image-grid.svelte';
  import EmptyState from '$lib/components/common/empty-state.svelte';
  import Image from '$lib/components/common/image.svelte';
  import Video from '$lib/components/common/video.svelte';
  import { getAssetURL } from '$lib/services/assets/view';

  const dispatch = createEventDispatcher();

  /** @type {Asset[]} */
  export let assets = [];
  export let searchTerms = '';

  $: filteredAssets = searchTerms
    ? assets.filter(({ name }) => name.toLowerCase().includes(searchTerms.toLowerCase()))
    : assets;
</script>

{#if filteredAssets.length}
  <div class="grid-wrapper">
    <SimpleImageGrid
      on:select={(/** @type {CustomEvent} */ event) => {
        dispatch('select', {
          asset: assets.find(({ sha }) => sha === event.detail.value),
        });
      }}
    >
      {#each filteredAssets as asset (asset.path)}
        <Option value={asset.sha}>
          {#if asset.kind === 'image'}
            <Image src={getAssetURL(asset)} alt={asset.name} checkerboard={true} />
          {:else if asset.kind === 'video'}
            <Video src={getAssetURL(asset)} />
          {:else}
            <span class="name">{asset.name}</span>
          {/if}
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

    :global(.listbox .option button) {
      border: 1px solid var(--secondary-border-color);
      border-radius: var(--control--medium--border-radius);
    }

    .name {
      display: flex;
      justify-content: center;
      align-items: center;
      overflow: hidden;
      width: 100%;
      height: 100%;
      padding: 8px;
      aspect-ratio: 1/1;
      word-break: break-all;
    }
  }
</style>
