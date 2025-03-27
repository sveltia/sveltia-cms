<script>
  import { Alert, ConfirmationDialog } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import UploadAssetsPreview from '$lib/components/assets/shared/upload-assets-preview.svelte';
  import { showAssetOverlay, uploadingAssets } from '$lib/services/assets';
  import { saveAssets } from '$lib/services/assets/data';
  import { showUploadAssetsConfirmDialog } from '$lib/services/assets/view';
  import { siteConfig } from '$lib/services/config';
  import { formatSize } from '$lib/services/utils/file';

  const { files, folder, originalAsset } = $derived($uploadingAssets);

  /** @type {File[]} */
  let uploadingFiles = $state([]);
  /** @type {File[]} */
  let oversizedFiles = $state([]);

  /** @type {number} */
  const maxFileSize = $derived.by(() => {
    // Support both new and legacy options
    const size =
      $siteConfig?.media_libraries?.default?.config?.max_file_size ??
      ($siteConfig?.media_library?.name === 'default'
        ? $siteConfig.media_library.config?.max_file_size
        : undefined);

    if (typeof size === 'number' && Number.isInteger(size)) {
      return size;
    }

    return Infinity;
  });

  $effect(() => {
    uploadingFiles = files.filter(({ size }) => size <= maxFileSize);
    oversizedFiles = files.filter(({ size }) => size > maxFileSize);
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
  okDisabled={!uploadingFiles.length}
  onOk={async () => {
    await saveAssets($uploadingAssets, { commitType: 'uploadMedia' });
    $uploadingAssets = { folder: undefined, files: [] };
  }}
  onCancel={() => {
    $uploadingAssets = { folder: undefined, files: [] };
  }}
>
  {#if uploadingFiles.length}
    <div role="group" class="section uploading" aria-label={$_('uploading_files')}>
      <div role="none">
        {#if originalAsset}
          {$_('confirm_replacing_file', {
            values: { name: originalAsset.name },
          })}
        {:else}
          {$_(uploadingFiles.length === 1 ? 'confirm_uploading_file' : 'confirm_uploading_files', {
            values: { count: uploadingFiles.length, folder: `/${folder}` },
          })}
        {/if}
      </div>
      <UploadAssetsPreview bind:files={uploadingFiles} />
    </div>
  {/if}
  {#if oversizedFiles.length}
    <div role="group" class="section oversized" aria-label={$_('oversized_files')}>
      <Alert status="warning">
        {$_(oversizedFiles.length === 1 ? 'warning_oversized_file' : 'warning_oversized_files', {
          values: { size: formatSize(maxFileSize) },
        })}
      </Alert>
      <UploadAssetsPreview bind:files={oversizedFiles} removable={false} />
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
