<script>
  import AssetListItem from '$lib/components/assets/list/asset-list-item.svelte';
  import { goto } from '$lib/services/app/navigation';
  import { focusedAsset, selectedAssetPathSet, selectedAssets } from '$lib/services/assets';
  import { canPreviewAsset } from '$lib/services/assets/kinds';
  import { listedAssetIndexMap } from '$lib/services/assets/view';
  import { toggleListItem } from '$lib/services/utils/array';

  /**
   * @import { Asset, ViewType } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {Asset} asset Asset.
   * @property {ViewType} viewType View type.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    asset,
    viewType,
    /* eslint-enable prefer-const */
  } = $props();

  /**
   * Update the asset selection.
   * @param {boolean} selected Whether the current asset item is selected.
   */
  const updateSelection = (selected) => {
    selectedAssets.current = toggleListItem(selectedAssets.current, asset, selected);
  };
</script>

<AssetListItem
  name={asset.name}
  kind={asset.kind}
  {asset}
  rowIndex={listedAssetIndexMap.current.get(asset.path) ?? -1}
  {viewType}
  selected={selectedAssetPathSet.current.has(asset.path)}
  canPreview={canPreviewAsset(asset)}
  onSelectionChange={updateSelection}
  onFocus={() => {
    focusedAsset.current = asset;
  }}
  onPreview={() => {
    goto(`/assets/${asset.path}`, { transitionType: 'forwards' });
  }}
/>
