<script>
  import { Dialog } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import UploadAssetsPreview from '$lib/components/assets/shared/upload-assets-preview.svelte';
  import { showUploadAssetsDialog, uploadingAssets } from '$lib/services/assets';
  import { saveAssets } from '$lib/services/assets/data';
  import { user } from '$lib/services/auth';
</script>

<!-- @todo Confirm to replace an old image if a file with the same same exists. -->

<Dialog
  open={$showUploadAssetsDialog}
  title={$_('upload_files')}
  okLabel={$_($user?.backendName === 'local' ? 'save' : 'upload_and_publish')}
  on:ok={async () => {
    await saveAssets($uploadingAssets, { commitType: 'uploadMedia' });
    $uploadingAssets = { folder: null, files: [] };
  }}
  on:cancel={() => {
    $uploadingAssets = { folder: null, files: [] };
  }}
>
  <div>
    {#if $uploadingAssets.files.length === 1}
      {$_('confirm_uploading_file', {
        values: {
          folder: `/${$uploadingAssets.folder}`,
        },
      })}
    {:else}
      {$_('confirm_uploading_files', {
        values: {
          number: $uploadingAssets.files.length,
          folder: `/${$uploadingAssets.folder}`,
        },
      })}
    {/if}
  </div>
  <UploadAssetsPreview bind:files={$uploadingAssets.files} />
</Dialog>
