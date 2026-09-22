<script>
  import AssetListItem from '$lib/components/assets/list/asset-list-item.svelte';
  import UnavailableBadge from '$lib/components/assets/list/external/unavailable-badge.svelte';
  import { goto } from '$lib/services/app/navigation';
  import {
    canPreviewExternalAsset,
    focusedExternalAsset,
    focusedExternalSubfolder,
    getExternalAssetPath,
    hasFolderSupport,
    selectedCloudService,
    selectedExternalAssets,
  } from '$lib/services/assets/external';
  import { externalAssetAvailability } from '$lib/services/assets/external/availability';
  import { LINKED_FILES_SERVICE_ID } from '$lib/services/assets/external/linked';
  import { browsingExternalFolders } from '$lib/services/assets/external/view';
  import { toggleListItem } from '$lib/services/utils/array';

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
   * Whether the asset is a file linked from an entry, which is checked for availability. The files
   * on a cloud storage service are listed by the service, so they always exist.
   */
  const isLinkedFile = $derived(
    selectedCloudService.current?.serviceId === LINKED_FILES_SERVICE_ID,
  );
  const unavailable = $derived(externalAssetAvailability.current[asset.id] === false);
  /**
   * The name shown: the file name while the service is browsed folder by folder, or the path when
   * a search lists the matches from every folder at once, so they can be told apart.
   */
  const name = $derived(
    hasFolderSupport(selectedCloudService.current) && !browsingExternalFolders.current
      ? asset.description
      : asset.fileName,
  );

  /**
   * Show the details of the asset.
   */
  const showDetails = () => {
    const service = selectedCloudService.current;

    /* v8 ignore next 3 -- the list is only shown while a service is selected */
    if (service) {
      goto(getExternalAssetPath(service, asset), { transitionType: 'forwards' });
    }
  };

  /**
   * Update the asset selection.
   * @param {boolean} _selected Whether the current asset item is selected.
   */
  const updateSelection = (_selected) => {
    selectedExternalAssets.current = toggleListItem(
      selectedExternalAssets.current,
      asset,
      _selected,
      (a, b) => a.id === b.id,
    );
  };
</script>

{#snippet status()}
  {#if unavailable}
    <UnavailableBadge />
  {/if}
{/snippet}

<AssetListItem
  {name}
  kind={asset.kind}
  src={asset.previewURL}
  rowIndex={index}
  {viewType}
  {selected}
  canPreview={canPreviewExternalAsset(asset)}
  onSelectionChange={updateSelection}
  onFocus={() => {
    focusedExternalAsset.current = asset;
    focusedExternalSubfolder.current = undefined;
  }}
  onPreview={() => {
    showDetails();
  }}
  status={isLinkedFile ? status : undefined}
/>
