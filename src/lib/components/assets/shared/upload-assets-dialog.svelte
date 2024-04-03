<script>
  import { Dialog } from '@sveltia/ui';
  import { onMount } from 'svelte';
  import { _ } from 'svelte-i18n';
  import DropZone from '$lib/components/assets/shared/drop-zone.svelte';
  import FilePicker from '$lib/components/assets/shared/file-picker.svelte';
  import { globalAssetFolder, selectedAssetFolder, uploadingAssets } from '$lib/services/assets';
  import { showUploadAssetsDialog } from '$lib/services/assets/view';

  let canDragDrop = true;
  /** @type {FilePicker} */
  let filePicker;

  /**
   * Update the asset list, which will show the confirmation dialog.
   * @param {File[]} files - Selected files.
   */
  const onSelect = (files) => {
    $uploadingAssets = {
      folder: $selectedAssetFolder?.internalPath || $globalAssetFolder?.internalPath,
      files,
    };
    $showUploadAssetsDialog = false;
  };

  onMount(() => {
    // Assume drag & drop is supported if the pointer is mouse (on desktop)
    canDragDrop = window.matchMedia('(pointer: fine)').matches;
  });

  $: {
    // Open the file picker directly if drag & drop is not supported (on mobile)
    if (!canDragDrop && filePicker && $showUploadAssetsDialog) {
      filePicker.open();
    }
  }
</script>

{#if canDragDrop}
  <Dialog title={$_('upload_assets')} bind:open={$showUploadAssetsDialog} showOk={false}>
    <DropZone
      showUploadButton={true}
      multiple={true}
      on:select={({ detail: { files } }) => {
        onSelect(files);
      }}
    />
  </Dialog>
{:else}
  <FilePicker
    bind:this={filePicker}
    multiple={true}
    on:select={({ detail: { files } }) => {
      onSelect(files);
    }}
  />
{/if}
