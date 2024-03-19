<script>
  import { Checkbox, GridCell, GridRow } from '@sveltia/ui';
  import AssetPreview from '$lib/components/assets/shared/asset-preview.svelte';
  import { focusedAsset, selectedAssets } from '$lib/services/assets';
  import { listedAssets } from '$lib/services/assets/view';
  import { goto } from '$lib/services/navigation';

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
   * @param {boolean} selected - Whether the current asset item is selected.
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
  on:focus={() => {
    $focusedAsset = asset;
  }}
  on:dblclick={() => {
    goto(`/assets/${$focusedAsset?.path}`);
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
    <AssetPreview
      {kind}
      {asset}
      variant={viewType === 'list' ? 'icon' : 'tile'}
      checkerboard={kind === 'image'}
    />
  </GridCell>
  <GridCell class="title">
    <span role="none">{name}</span>
  </GridCell>
</GridRow>
