<script>
  import { ConfirmationDialog } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import UploadAssetsPreview from '$lib/components/assets/shared/upload-assets-preview.svelte';
  import { uploadingAssets } from '$lib/services/assets';
  import { saveAssets } from '$lib/services/assets/data';
  import { showUploadAssetsConfirmDialog } from '$lib/services/assets/view';

  $: ({ files, folder, originalAsset } = $uploadingAssets);
</script>

<!-- @todo Confirm to replace an old image if a file with the same same exists. -->

<ConfirmationDialog
  open={$showUploadAssetsConfirmDialog}
  title={$_(originalAsset ? 'replace_asset' : 'upload_assets')}
  okLabel={$_(originalAsset ? 'replace' : 'upload')}
  on:ok={async () => {
    await saveAssets($uploadingAssets, { commitType: 'uploadMedia' });
    $uploadingAssets = { folder: undefined, files: [] };
  }}
  on:cancel={() => {
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
      {$_(files.length === 1 ? 'confirm_uploading_file' : 'confirm_uploading_files', {
        values: {
          count: files.length,
          folder: `/${folder}`,
        },
      })}
    {/if}
  </div>
  <UploadAssetsPreview bind:files />
</ConfirmationDialog>
