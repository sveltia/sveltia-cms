<script>
  import { Dialog } from '@sveltia/ui';
  import mime from 'mime';
  import { _ } from 'svelte-i18n';
  import DropZone from '$lib/components/assets/shared/drop-zone.svelte';
  import FilePicker from '$lib/components/assets/shared/file-picker.svelte';
  import {
    globalAssetFolder,
    selectedAssetFolder,
    showAssetOverlay,
    uploadingAssets,
  } from '$lib/services/assets';
  import { showUploadAssetsDialog } from '$lib/services/assets/view';
  import { canDragDrop } from '$lib/services/utils/file';

  /** @type {FilePicker} */
  let filePicker;

  $: ({ originalAsset } = $uploadingAssets);
  $: multiple = !originalAsset;
  $: accept = originalAsset ? (mime.getType(originalAsset.name) ?? undefined) : undefined;

  /**
   * Update the asset list, which will show the confirmation dialog.
   * @param {File[]} files - Selected files.
   */
  const onSelect = (files) => {
    if (!files.length) {
      return;
    }

    $uploadingAssets = {
      folder: originalAsset
        ? originalAsset.folder
        : $selectedAssetFolder?.internalPath || $globalAssetFolder?.internalPath,
      files,
      originalAsset,
    };
    $showUploadAssetsDialog = false;
  };

  $: {
    // Open the file picker directly if drag & drop is not supported (on mobile)
    if (!canDragDrop() && filePicker && $showUploadAssetsDialog) {
      filePicker.open();
    }
  }

  $: {
    if (!$showAssetOverlay) {
      $showUploadAssetsDialog = false;
    }
  }
</script>

{#if canDragDrop()}
  <Dialog
    title={originalAsset
      ? $_('replace_x', { values: { name: originalAsset.name } })
      : $_('upload_assets')}
    bind:open={$showUploadAssetsDialog}
    showOk={false}
  >
    <DropZone
      showUploadButton={true}
      {accept}
      {multiple}
      onSelect={({ files }) => {
        onSelect(files);
      }}
    />
  </Dialog>
{:else}
  <FilePicker
    bind:this={filePicker}
    {accept}
    {multiple}
    onSelect={({ files }) => {
      onSelect(files);
    }}
  />
{/if}
