<script>
  import { _ } from '@sveltia/i18n';
  import { Alert, ConfirmationDialog, Radio, RadioGroup, Toast } from '@sveltia/ui';
  import { getPathInfo } from '@sveltia/utils/file';

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
  import { formatSize, isEquivalentFileExtension } from '$lib/services/utils/file';

  /** @type {File[]} */
  let files = $state([]);
  let replaceFiles = $state(true);
  // Committing to a remote repository takes a few seconds, and the confirmation dialog is gone by
  // then, so the upload would otherwise happen with nothing on screen to say it’s under way
  let uploading = $state(false);
  let uploadFailed = $state(false);

  const { files: originalFiles, folder, originalAssets } = $derived($uploadingAssets);
  const originalAsset = $derived(originalAssets?.[0]);
  const { processing, validFiles, oversizedFiles, invalidFiles, transformedFileMap } =
    $derived($processedAssets);
  const { max_file_size: maxSize } = $derived(getDefaultMediaLibraryOptions().config);
  const assetsInSameFolder = $derived(
    originalAsset || folder?.internalPath === undefined
      ? []
      : getAssetsByDirName(folder.internalPath),
  );
  const dupFiles = $derived(getDuplicateFiles(files, assetsInSameFolder));
  const dupFileCount = $derived(dupFiles.length);
  // A replacement file keeps the name of the asset it replaces, so it has to be in the same
  // format: `cat.jpg` can be replaced with `cat2.jpeg`, which is that same format under another
  // extension, while a `cat.png` is a different thing that can’t be saved under the `.jpg` name.
  // This is checked here, rather than on the file the user picked, because an image is transcoded
  // first when `transformations` is configured — a `.jpg` chosen for a `.jpg` asset can well
  // arrive as a `.webp`.
  const mismatchedFiles = $derived(
    originalAsset
      ? validFiles.filter(
          (file) =>
            !isEquivalentFileExtension(
              getPathInfo(file.name).extension,
              getPathInfo(originalAsset.name).extension,
            ),
        )
      : [],
  );

  $effect(() => {
    files = validFiles.filter((file) => !mismatchedFiles.includes(file));
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
    uploading = true;

    try {
      await saveAssets(
        originalAsset
          ? { files, folder, originalAssets }
          : { files, folder, replaceDuplicates: replaceFiles },
        { commitType: 'uploadMedia' },
      );
    } catch (/** @type {any} */ ex) {
      uploadFailed = true;
      // eslint-disable-next-line no-console
      console.error(ex);
    } finally {
      uploading = false;
      // Clear the selection whatever happened, so a failed upload doesn’t leave the store holding
      // files that no dialog is showing any more
      $uploadingAssets = { folder: undefined, files: [] };
    }
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
  {#if invalidFiles.length}
    <div role="group" class="section invalid" aria-label={_('invalid_files')}>
      <Alert status="warning">
        {_('warning_invalid_files', { values: { count: invalidFiles.length } })}
      </Alert>
      <!-- An invalid file is never transformed, so there’s no original to map it back to -->
      <UploadAssetsPreview files={invalidFiles} removable={false} showThumbnail={false} />
    </div>
  {/if}
  {#if mismatchedFiles.length}
    <div role="group" class="section mismatched" aria-label={_('mismatched_files')}>
      <Alert status="warning">
        {_('warning_mismatched_files', {
          values: { count: mismatchedFiles.length, name: originalAsset?.name },
        })}
      </Alert>
      <UploadAssetsPreview files={mismatchedFiles} {transformedFileMap} removable={false} />
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

<!-- `duration={0}` keeps this up until the upload settles, however long the commit takes -->
<Toast bind:show={uploading} duration={0}>
  <Alert status="info">{_('uploading_files_progress')}</Alert>
</Toast>

<Toast bind:show={uploadFailed}>
  <Alert status="error">{_('uploading_files_failed')}</Alert>
</Toast>

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

    &.oversized :global(.files),
    &.invalid :global(.files),
    &.mismatched :global(.files) {
      opacity: 0.5;
    }
  }
</style>
