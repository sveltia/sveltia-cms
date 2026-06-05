<script>
  import { _ } from '@sveltia/i18n';
  import { Dialog, FilePicker } from '@sveltia/ui';
  import mime from 'mime';

  import DropZone from '$lib/components/assets/shared/drop-zone.svelte';
  import { uploadingAssets } from '$lib/services/assets';
  import { targetAssetFolder } from '$lib/services/assets/folders';
  import { showAssetOverlay, showUploadAssetsDialog } from '$lib/services/assets/view';
  import { env } from '$lib/services/user/env.svelte';

  /** @type {FilePicker | undefined} */
  let filePicker = $state();

  const { originalAssets } = $derived($uploadingAssets);
  // Use the first asset because replacement only supports one asset for now
  const originalAsset = $derived(originalAssets?.[0]);
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
      originalAssets,
    };
    $showUploadAssetsDialog = false;
  };

  $effect(() => {
    // Open the file picker directly if drag & drop is not supported (on mobile)
    if (!env.hasMouse && $showUploadAssetsDialog) {
      filePicker?.open();
    }
  });

  $effect(() => {
    if (!$showAssetOverlay) {
      $showUploadAssetsDialog = false;
    }
  });
</script>

{#if env.hasMouse}
  <Dialog
    title={originalAsset
      ? _('replace_x', { values: { name: originalAsset.name } })
      : _('upload_assets')}
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
