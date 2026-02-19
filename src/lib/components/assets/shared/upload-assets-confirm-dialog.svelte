<script>
  import { Alert, ConfirmationDialog } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';

  import UploadAssetsPreview from '$lib/components/assets/shared/upload-assets-preview.svelte';
  import { processedAssets, uploadingAssets } from '$lib/services/assets';
  import { saveAssets } from '$lib/services/assets/data/create';
  import { showAssetOverlay, showUploadAssetsConfirmDialog } from '$lib/services/assets/view';
  import { getDefaultMediaLibraryOptions } from '$lib/services/integrations/media-libraries/default';
  import { formatSize } from '$lib/services/utils/file';

  /** @type {File[]} */
  // eslint-disable-next-line svelte/prefer-writable-derived
  let files = $state([]);

  const { files: originalFiles, folder, originalAsset } = $derived($uploadingAssets);
  const { processing, undersizedFiles, oversizedFiles, transformedFileMap } =
    $derived($processedAssets);
  const { max_file_size: maxSize } = $derived(getDefaultMediaLibraryOptions().config);

  $effect(() => {
    files = [...undersizedFiles];
  });

  $effect(() => {
    if (!$showAssetOverlay) {
      // Close the dialog
      $uploadingAssets = { folder: undefined, files: [] };
    }
  });
</script>

<!-- @todo Confirm to replace an old image if a file with the same same exists. -->

<ConfirmationDialog
  open={$showUploadAssetsConfirmDialog}
  title={$_(originalAsset ? 'replace_asset' : 'upload_assets')}
  okLabel={$_(originalAsset ? 'replace' : 'upload')}
  okDisabled={!files.length}
  onOk={async () => {
    await saveAssets({ files, folder, originalAsset }, { commitType: 'uploadMedia' });
    $uploadingAssets = { folder: undefined, files: [] };
  }}
  onCancel={() => {
    $uploadingAssets = { folder: undefined, files: [] };
  }}
>
  {#if processing}
    <div role="status">
      {$_(originalFiles.length === 1 ? 'processing_file' : 'processing_files')}
    </div>
  {/if}
  {#if files.length}
    <div role="group" class="section uploading" aria-label={$_('uploading_files')}>
      <div role="none">
        {#if originalAsset}
          {$_('confirm_replacing_file', {
            values: { name: originalAsset.name },
          })}
        {:else}
          {$_(files.length === 1 ? 'confirm_uploading_file' : 'confirm_uploading_files', {
            values: { count: files.length, folder: `/${folder?.internalPath}` },
          })}
        {/if}
      </div>
      <UploadAssetsPreview bind:files {transformedFileMap} />
    </div>
  {/if}
  {#if oversizedFiles.length}
    <div role="group" class="section oversized" aria-label={$_('oversized_files')}>
      <Alert status="warning">
        {$_(oversizedFiles.length === 1 ? 'warning_oversized_file' : 'warning_oversized_files', {
          values: { size: formatSize(/** @type {number} */ (maxSize)) },
        })}
      </Alert>
      <UploadAssetsPreview files={oversizedFiles} {transformedFileMap} removable={false} />
    </div>
  {/if}
</ConfirmationDialog>

<style lang="scss">
  .section {
    display: flex;
    flex-direction: column;
    gap: 16px;

    &:not(:first-child) {
      margin-top: 16px;
    }

    & > :global(*) {
      flex: none;
    }

    &.oversized :global(.files) {
      opacity: 0.5;
    }
  }
</style>
