<!--
  @component
  Edit options menu for an asset on a cloud storage service: Rename, Move and Replace.
-->
<script>
  import { FilePicker } from '@sveltia/ui';

  import EditOptionsMenu from '$lib/components/assets/list/edit-options-menu.svelte';
  import { renamingExternalAsset, selectedCloudService } from '$lib/services/assets/external';
  import { uploadingExternalAssets } from '$lib/services/assets/external/data';
  import { canMoveExternalAssets } from '$lib/services/assets/movable';
  import { assetMoveRequest } from '$lib/services/assets/state';

  /**
   * @import { Snippet } from 'svelte';
   * @import { ExternalAsset } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {ExternalAsset} [asset] Selected asset.
   * @property {ExternalAsset[]} [assets] Assets the Move item applies to, as several can be
   * selected in the list. Default: the selected asset.
   * @property {Snippet} [extraItems] Slot content.
   */

  /** @type {Props} */
  let { asset, assets = asset ? [asset] : [], extraItems = undefined } = $props();

  /** @type {FilePicker | undefined} */
  let replaceFilePicker = $state();

  const service = $derived(selectedCloudService.current);

  /**
   * Replace the asset with the given file.
   * @param {File} file File.
   */
  const replaceAsset = (file) => {
    /* v8 ignore next 3 -- the picker is only opened for an asset */
    if (asset) {
      uploadingExternalAssets.current = { files: [file], originalAsset: asset };
    }
  };
</script>

<!-- The items for operations the service doesn’t support are omitted rather than disabled -->
<EditOptionsMenu
  canRename={!!asset}
  canReplace={!!asset}
  canMove={!!service && canMoveExternalAssets(service, assets)}
  onRename={service?.rename
    ? () => {
        renamingExternalAsset.current = asset;
      }
    : undefined}
  onMove={service?.delete
    ? () => {
        assetMoveRequest.current = { externalAssets: [...assets], service };
      }
    : undefined}
  onReplace={service?.replace
    ? () => {
        replaceFilePicker?.open();
      }
    : undefined}
  {extraItems}
/>

<FilePicker
  bind:this={replaceFilePicker}
  onSelect={({ file }) => {
    replaceAsset(file);
  }}
/>
