<script>
  import { GridCell, Row } from '@sveltia/ui';
  import AssetCheckbox from '$lib/components/assets/list/asset-checkbox.svelte';
  import Image from '$lib/components/common/image.svelte';
  import Video from '$lib/components/common/video.svelte';
  import { selectedAsset, selectedAssets } from '$lib/services/assets';
  import { currentView, getAssetURL } from '$lib/services/assets/view';

  /** @type {Asset} */
  export let asset;

  $: ({ name, kind } = asset);
</script>

<!-- @todo Add support for drag to move. -->

<Row
  aria-selected={$selectedAssets.includes(asset)}
  on:click={() => {
    $selectedAsset = asset;

    if (!$currentView?.showInfo) {
      currentView.update((view) => ({
        ...view,
        showInfo: !$currentView?.showInfo,
      }));
    }
  }}
>
  <GridCell class="checkbox">
    <AssetCheckbox {asset} />
  </GridCell>
  <GridCell class="image">
    {#if kind === 'image'}
      <Image src={getAssetURL(asset)} checkerboard={true} />
    {/if}
    {#if kind === 'video'}
      <Video src={getAssetURL(asset)} />
    {/if}
  </GridCell>
  <GridCell class="title">
    <span>{name}</span>
  </GridCell>
</Row>
