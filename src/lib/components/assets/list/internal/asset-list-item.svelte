<script>
  import AssetListItem from '$lib/components/assets/list/asset-list-item.svelte';
  import { createAssetDragSource } from '$lib/services/assets/drag';
  import { canPreviewAsset } from '$lib/services/assets/kinds';
  import { canMoveAssets, getDraggedAssets } from '$lib/services/assets/movable';
  import { showAssetDetails } from '$lib/services/assets/navigation';
  import { focusedAsset, selectedAssetPathSet, selectedAssets } from '$lib/services/assets/state';
  import { focusedSubfolder } from '$lib/services/assets/subfolders';
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
  let { asset, viewType } = $props();

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
  dragSource={canMoveAssets([asset])
    ? createAssetDragSource(() => getDraggedAssets(asset))
    : undefined}
  onFocus={() => {
    focusedAsset.current = asset;
    // Show the asset’s info in the sidebar in place of a folder’s
    focusedSubfolder.current = undefined;
  }}
  onPreview={() => {
    // Stay in the selected folder, e.g. All Assets, rather than moving to the asset’s own folder
    showAssetDetails(asset);
  }}
/>
