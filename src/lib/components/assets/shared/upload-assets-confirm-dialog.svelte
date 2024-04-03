<script>
  import { ConfirmationDialog } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import UploadAssetsPreview from '$lib/components/assets/shared/upload-assets-preview.svelte';
  import { uploadingAssets } from '$lib/services/assets';
  import { saveAssets } from '$lib/services/assets/data';
  import { showUploadAssetsConfirmDialog } from '$lib/services/assets/view';
  import { backendName } from '$lib/services/backends';
</script>

<!-- @todo Confirm to replace an old image if a file with the same same exists. -->

<ConfirmationDialog
  open={$showUploadAssetsConfirmDialog}
  title={$_('upload_assets')}
  okLabel={$_($backendName === 'local' ? 'save' : 'upload')}
  on:ok={async () => {
    await saveAssets($uploadingAssets, { commitType: 'uploadMedia' });
    $uploadingAssets = { folder: undefined, files: [] };
  }}
  on:cancel={() => {
    $uploadingAssets = { folder: undefined, files: [] };
  }}
>
  <div role="none">
    {#if $uploadingAssets.files.length === 1}
      {$_('confirm_uploading_file', {
        values: {
          folder: `/${$uploadingAssets.folder}`,
        },
      })}
    {:else}
      {$_('confirm_uploading_files', {
        values: {
          count: $uploadingAssets.files.length,
          folder: `/${$uploadingAssets.folder}`,
        },
      })}
    {/if}
  </div>
  <UploadAssetsPreview bind:files={$uploadingAssets.files} />
</ConfirmationDialog>
