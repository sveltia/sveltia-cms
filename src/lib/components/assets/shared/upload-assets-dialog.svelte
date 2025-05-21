<script>
  import { Dialog, FilePicker } from '@sveltia/ui';
  import mime from 'mime';
  import { _ } from 'svelte-i18n';
  import DropZone from '$lib/components/assets/shared/drop-zone.svelte';
  import { showAssetOverlay, targetAssetFolder, uploadingAssets } from '$lib/services/assets';
  import { showUploadAssetsDialog } from '$lib/services/assets/view';
  import { hasMouse } from '$lib/services/user/env';

  /** @type {FilePicker | undefined} */
  let filePicker = $state();

  const { originalAsset } = $derived($uploadingAssets);
  const multiple = $derived(!originalAsset);
  const accept = $derived(
    originalAsset ? (mime.getType(originalAsset.name) ?? undefined) : undefined,
  );

  /**
   * Update the asset list, which will show the confirmation dialog.
   * @param {File[]} files Selected files.
   */
  const onSelect = (files) => {
    if (!files.length) {
      return;
    }

    $uploadingAssets = {
      folder: originalAsset ? originalAsset.folder : $targetAssetFolder,
      files,
      originalAsset,
    };
    $showUploadAssetsDialog = false;
  };

  $effect(() => {
    // Open the file picker directly if drag & drop is not supported (on mobile)
    if (!$hasMouse && $showUploadAssetsDialog) {
      filePicker?.open();
    }
  });

  $effect(() => {
    if (!$showAssetOverlay) {
      $showUploadAssetsDialog = false;
    }
  });
</script>

{#if $hasMouse}
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
      onDrop={({ files }) => {
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
    onCancel={() => {
      $showUploadAssetsDialog = false;
    }}
  />
{/if}
