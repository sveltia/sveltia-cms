<!--
  @component Edit options menu for an asset on a cloud storage service: Rename and Replace.
-->
<script>
  import { FilePicker } from '@sveltia/ui';

  import EditOptionsMenu from '$lib/components/assets/list/edit-options-menu.svelte';
  import { renamingExternalAsset, selectedCloudService } from '$lib/services/assets/external';
  import { uploadingExternalAssets } from '$lib/services/assets/external/data';

  /**
   * @import { Snippet } from 'svelte';
   * @import { ExternalAsset } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {ExternalAsset} [asset] Selected asset.
   * @property {Snippet} [extraItems] Slot content.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    asset,
    extraItems = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  /** @type {FilePicker | undefined} */
  let replaceFilePicker = $state();

  const service = $derived(selectedCloudService.current);
</script>

<!-- The items for operations the service doesn’t support are omitted rather than disabled -->
<EditOptionsMenu
  canRename={!!asset}
  canReplace={!!asset}
  onRename={service?.rename
    ? () => {
        renamingExternalAsset.current = asset;
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
    if (asset) {
      uploadingExternalAssets.current = { files: [file], originalAsset: asset };
    }
  }}
/>
