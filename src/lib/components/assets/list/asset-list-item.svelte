<script>
  import { TableCell, TableRow } from '@sveltia/ui';
  import AssetCheckbox from '$lib/components/assets/list/asset-checkbox.svelte';
  import Image from '$lib/components/common/image.svelte';
  import Video from '$lib/components/common/video.svelte';
  import { selectedAsset, selectedAssets } from '$lib/services/assets';
  import { currentView } from '$lib/services/assets/view';

  /**
   * @type {Asset}
   */
  export let asset;
  /**
   * @type {ViewType}
   */
  export let viewType;

  $: ({ name, kind } = asset);
</script>

<!-- @todo Add support for drag to move. -->

<TableRow
  selected={$selectedAssets.includes(asset)}
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
  <TableCell class="checkbox">
    <AssetCheckbox {asset} />
  </TableCell>
  <TableCell class="image">
    {#if kind === 'image'}
      <Image {asset} variant={viewType === 'list' ? 'icon' : 'tile'} />
    {/if}
    {#if kind === 'video'}
      <Video {asset} variant={viewType === 'list' ? 'icon' : 'tile'} />
    {/if}
  </TableCell>
  <TableCell class="title">
    <span>{name}</span>
  </TableCell>
</TableRow>
