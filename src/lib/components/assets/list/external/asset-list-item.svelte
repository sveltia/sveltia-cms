<script>
  import AssetListItem from '$lib/components/assets/list/asset-list-item.svelte';
  import { goto } from '$lib/services/app/navigation';
  import {
    canPreviewExternalAsset,
    focusedExternalAsset,
    getExternalAssetPath,
    selectedCloudService,
    selectedExternalAssets,
  } from '$lib/services/assets/external';

  /**
   * @import { ExternalAsset, ViewType } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {ExternalAsset} asset Asset.
   * @property {number} index Index of the asset in the list.
   * @property {ViewType} viewType View type.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    asset,
    index,
    viewType,
    /* eslint-enable prefer-const */
  } = $props();

  const selected = $derived(selectedExternalAssets.current.some((a) => a.id === asset.id));

  /**
   * Update the asset selection.
   * @param {boolean} _selected Whether the current asset item is selected.
   */
  const updateSelection = (_selected) => {
    const assets = selectedExternalAssets.current;

    if (_selected && !selected) {
      selectedExternalAssets.current = [...assets, asset];
    }

    if (!_selected && selected) {
      selectedExternalAssets.current = assets.filter((a) => a.id !== asset.id);
    }
  };
</script>

<AssetListItem
  name={asset.fileName}
  kind={asset.kind}
  src={asset.previewURL}
  rowIndex={index}
  {viewType}
  {selected}
  canPreview={canPreviewExternalAsset(asset)}
  onSelectionChange={updateSelection}
  onFocus={() => {
    focusedExternalAsset.current = asset;
  }}
  onPreview={() => {
    const service = selectedCloudService.current;

    if (service) {
      goto(getExternalAssetPath(service, asset), { transitionType: 'forwards' });
    }
  }}
/>
