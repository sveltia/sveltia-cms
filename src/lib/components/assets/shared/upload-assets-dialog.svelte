<script>
  import { _ } from '@sveltia/i18n';
  import { Dialog, FilePicker } from '@sveltia/ui';
  import mime from 'mime';
  import { untrack } from 'svelte';

  import DropZone from '$lib/components/assets/shared/drop-zone.svelte';
  import { uploadingAssets } from '$lib/services/assets';
  import { targetAssetFolder } from '$lib/services/assets/folders';
  import { showAssetOverlay, showUploadAssetsDialog } from '$lib/services/assets/view';
  import { env } from '$lib/services/user/env.svelte';

  /** @type {FilePicker | undefined} */
  let filePicker = $state();

  const { originalAssets } = $derived(uploadingAssets.current);
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

    uploadingAssets.current = {
      folder: originalAsset ? originalAsset.folder : targetAssetFolder.current,
      files,
      originalAssets,
    };
    showUploadAssetsDialog.current = false;
  };

  $effect(() => {
    // Open the file picker directly if drag & drop is not supported (on mobile)
    if (!env.hasMouse && showUploadAssetsDialog.current) {
      filePicker?.open();
    }
  });

  $effect(() => {
    if (!showAssetOverlay.current) {
      showUploadAssetsDialog.current = false;
    }
  });

  $effect(() => {
    if (!showUploadAssetsDialog.current) {
      // A replacement request is written to the store before this dialog opens, and consumed by
      // `onSelect` above. Dismissing the dialog would otherwise leave it behind, and the next
      // ordinary upload would be treated as a replacement of that asset — with the wrong dialog
      // title, a single-file picker and an `accept` list restricted to the asset’s own type.
      // `onSelect` stores the files before it closes the dialog, so a non-empty list here means a
      // selection was made and the request is still in use.
      untrack(() => {
        if (!uploadingAssets.current.files.length && uploadingAssets.current.originalAssets) {
          uploadingAssets.current = { folder: undefined, files: [] };
        }
      });
    }
  });
</script>

{#if env.hasMouse}
  <Dialog
    title={originalAsset
      ? _('replace_x', { values: { name: originalAsset.name } })
      : _('upload_assets')}
    bind:open={showUploadAssetsDialog.current}
    showOk={false}
  >
    <!--
      Dropped files are not filtered by `accept` here: `<UploadAssetsConfirmDialog>` checks the
      format once the files have been processed, which is the only point a transformation could
      have changed it. The attribute still narrows the file picker.
    -->
    <DropZone
      showUploadButton={true}
      {accept}
      {multiple}
      filterDroppedFiles={false}
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
      showUploadAssetsDialog.current = false;
    }}
  />
{/if}
