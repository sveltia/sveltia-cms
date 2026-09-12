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

<EditOptionsMenu
  canRename={!!asset && !!service?.rename}
  canReplace={!!asset && !!service?.replace}
  onRename={() => {
    renamingExternalAsset.current = asset;
  }}
  onReplace={() => {
    replaceFilePicker?.open();
  }}
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
