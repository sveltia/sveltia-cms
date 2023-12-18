<script>
  import { Checkbox, GridCell, GridRow } from '@sveltia/ui';
  import Image from '$lib/components/common/image.svelte';
  import Video from '$lib/components/common/video.svelte';
  import { selectedAsset, selectedAssets } from '$lib/services/assets';
  import { currentView, listedAssets } from '$lib/services/assets/view';

  /**
   * @type {Asset}
   */
  export let asset;
  /**
   * @type {ViewType}
   */
  export let viewType;

  $: ({ name, kind } = asset);

  /**
   * Update the asset selection.
   * @param {boolean} selected Whether the current asset item is selected.
   */
  const updateSelection = (selected) => {
    selectedAssets.update((assets) => {
      const index = assets.indexOf(asset);

      if (selected && index === -1) {
        assets.push(asset);
      }

      if (!selected && index > -1) {
        assets.splice(index, 1);
      }

      return assets;
    });
  };
</script>

<!-- @todo Add support for drag to move. -->

<GridRow
  aria-rowindex={$listedAssets.indexOf(asset)}
  on:change={(event) => {
    updateSelection(/** @type {CustomEvent} */ (event).detail.selected);
  }}
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
    <Checkbox
      role="none"
      tabindex="-1"
      checked={$selectedAssets.includes(asset)}
      on:change={({ detail: { checked } }) => {
        updateSelection(checked);
      }}
    />
  </GridCell>
  <GridCell class="image">
    {#if kind === 'image'}
      <Image {asset} variant={viewType === 'list' ? 'icon' : 'tile'} checkerboard={true} />
    {/if}
    {#if kind === 'video'}
      <Video {asset} variant={viewType === 'list' ? 'icon' : 'tile'} />
    {/if}
  </GridCell>
  <GridCell class="title">
    <span role="none">{name}</span>
  </GridCell>
</GridRow>
