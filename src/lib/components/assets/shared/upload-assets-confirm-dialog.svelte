<script>
  import { ConfirmationDialog } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import UploadAssetsPreview from '$lib/components/assets/shared/upload-assets-preview.svelte';
  import { showAssetOverlay, uploadingAssets } from '$lib/services/assets';
  import { saveAssets } from '$lib/services/assets/data';
  import { showUploadAssetsConfirmDialog } from '$lib/services/assets/view';

  const { files, folder, originalAsset } = $derived($uploadingAssets);

  /** @type {File[]} */
  let uploadingFiles = $state([]);

  $effect(() => {
    uploadingFiles = [...files];
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
  onOk={async () => {
    await saveAssets($uploadingAssets, { commitType: 'uploadMedia' });
    $uploadingAssets = { folder: undefined, files: [] };
  }}
  onCancel={() => {
    $uploadingAssets = { folder: undefined, files: [] };
  }}
>
  <div role="none">
    {#if originalAsset}
      {$_('confirm_replacing_file', {
        values: {
          name: originalAsset.name,
        },
      })}
    {:else}
      {$_(uploadingFiles.length === 1 ? 'confirm_uploading_file' : 'confirm_uploading_files', {
        values: {
          count: uploadingFiles.length,
          folder: `/${folder}`,
        },
      })}
    {/if}
  </div>
  <UploadAssetsPreview bind:files={uploadingFiles} />
</ConfirmationDialog>
