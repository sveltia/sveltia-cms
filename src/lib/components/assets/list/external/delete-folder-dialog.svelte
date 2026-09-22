<!--
  @component
  Delete Folder dialog for a cloud storage service, opened for the subfolder set as
  `deletingExternalSubfolder`. Deleting removes every file in the folder.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { ConfirmationDialog } from '@sveltia/ui';

  import { deletingExternalSubfolder } from '$lib/services/assets/external';
  import {
    deleteExternalFolder,
    getExternalSubfolderAssets,
  } from '$lib/services/assets/external/data';

  let open = $state(false);

  const subfolder = $derived(deletingExternalSubfolder.current);
  /* v8 ignore start -- these are only read while the dialog is open, which takes a folder */
  const folderName = $derived(subfolder?.name ?? '');
  /** Number of assets in the folder, at any depth, which will be deleted along. */
  const assetCount = $derived(subfolder ? getExternalSubfolderAssets(subfolder.path).length : 0);
  /* v8 ignore stop */

  $effect(() => {
    if (subfolder) {
      open = true;
    }
  });
</script>

<ConfirmationDialog
  bind:open
  title={_('delete_folder')}
  okLabel={_('delete')}
  onOk={() => {
    /* v8 ignore next 3 -- the dialog is only open for a folder */
    if (subfolder) {
      deleteExternalFolder(subfolder);
    }
  }}
  onClose={() => {
    // The dialog is closed before the deletion is confirmed, so the folder is let go of here
    // rather than when `open` turns false
    deletingExternalSubfolder.current = undefined;
  }}
>
  {_('confirm_deleting_folder', { values: { name: folderName, count: assetCount } })}
</ConfirmationDialog>
