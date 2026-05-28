<script>
  import { _ } from '@sveltia/i18n';
  import { Alert, ConfirmationDialog, Radio, RadioGroup } from '@sveltia/ui';

  import UploadAssetsPreview from '$lib/components/assets/shared/upload-assets-preview.svelte';
  import {
    getAssetsByDirName,
    getDuplicateFiles,
    processedAssets,
    uploadingAssets,
  } from '$lib/services/assets';
  import { saveAssets } from '$lib/services/assets/data/create';
  import { showAssetOverlay, showUploadAssetsConfirmDialog } from '$lib/services/assets/view';
  import { getDefaultMediaLibraryOptions } from '$lib/services/integrations/media-libraries/default';
  import { formatSize } from '$lib/services/utils/file';

  /** @type {File[]} */
  let files = $state([]);
  let replaceFiles = $state(true);

  const { files: originalFiles, folder, originalAssets } = $derived($uploadingAssets);
  const originalAsset = $derived(originalAssets?.[0]);
  const { processing, undersizedFiles, oversizedFiles, transformedFileMap } =
    $derived($processedAssets);
  const { max_file_size: maxSize } = $derived(getDefaultMediaLibraryOptions().config);
  const assetsInSameFolder = $derived(
    originalAsset || folder?.internalPath === undefined
      ? []
      : getAssetsByDirName(folder.internalPath),
  );
  const dupFiles = $derived(getDuplicateFiles(files, assetsInSameFolder));
  const dupFileCount = $derived(dupFiles.length);

  $effect(() => {
    files = [...undersizedFiles];
    replaceFiles = true;
  });

  $effect(() => {
    if (!$showAssetOverlay) {
      // Close the dialog
      $uploadingAssets = { folder: undefined, files: [] };
    }
  });
</script>

<ConfirmationDialog
  open={$showUploadAssetsConfirmDialog}
  title={_(originalAsset ? 'replace_asset' : 'upload_assets')}
  okLabel={_(originalAsset ? 'replace' : 'upload')}
  okDisabled={!files.length}
  onOk={async () => {
    const original = originalAsset ? originalAssets : replaceFiles ? assetsInSameFolder : [];

    await saveAssets({ files, folder, originalAssets: original }, { commitType: 'uploadMedia' });
    $uploadingAssets = { folder: undefined, files: [] };
  }}
  onCancel={() => {
    $uploadingAssets = { folder: undefined, files: [] };
  }}
>
  {#if processing}
    <div role="status">
      {_('processing_files', { values: { count: originalFiles.length } })}
    </div>
  {/if}
  {#if files.length}
    <div role="group" class="section uploading" aria-label={_('uploading_files')}>
      <div role="none">
        {#if originalAsset}
          {_('confirm_replacing_file', {
            values: { name: originalAsset.name },
          })}
        {:else}
          {_('confirm_uploading_files', {
            values: { count: files.length, folder: `/${folder?.internalPath}` },
          })}
        {/if}
      </div>
      <UploadAssetsPreview bind:files {transformedFileMap} />
    </div>
  {/if}
  {#if oversizedFiles.length}
    <div role="group" class="section oversized" aria-label={_('oversized_files')}>
      <Alert status="warning">
        {_('warning_oversized_files', {
          values: {
            count: oversizedFiles.length,
            size: formatSize(/** @type {number} */ (maxSize)),
          },
        })}
      </Alert>
      <UploadAssetsPreview files={oversizedFiles} {transformedFileMap} removable={false} />
    </div>
  {/if}
  {#if dupFileCount}
    <div role="group" class="section">
      {_('file_name_conflict_confirmation', { values: { count: dupFileCount } })}
      <RadioGroup
        aria-label={_('file_name_conflict_resolution')}
        onChange={({ detail }) => {
          replaceFiles = detail.value === 'replace';
        }}
      >
        <Radio value="replace" checked={replaceFiles}>{_('replace')}</Radio>
        <Radio value="keep" checked={!replaceFiles}>{_('keep_both')}</Radio>
      </RadioGroup>
    </div>
  {/if}
</ConfirmationDialog>

<style>
  .section {
    display: flex;
    flex-direction: column;
    gap: 12px;

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
