<!--
  @component
  Delete Folder dialog of the Asset Library, opened for the subfolder set as `deletingSubfolder`.
  Deleting removes every asset in the folder, along with the references to them in the entries,
  which the dialog reports — or refuses the deletion over, if a field would be left invalid.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Alert, ConfirmationDialog, Toast } from '@sveltia/ui';

  import CascadeDeleteNote from '$lib/components/common/cascade-delete-note.svelte';
  import { planAssetDeletion } from '$lib/services/assets/data/cascade';
  import { deleteSubfolder, getSubfolderAssets } from '$lib/services/assets/data/subfolder';
  import { deletingSubfolder } from '$lib/services/assets/subfolders';

  /**
   * @import { CascadeDeletePlan } from '$lib/types/private';
   */

  let open = $state(false);
  let deletionFailed = $state(false);
  /**
   * Plan for the assets in the folder, or `undefined` while it’s being worked out.
   * @type {CascadeDeletePlan | undefined}
   */
  let plan = $state();

  const subfolder = $derived(deletingSubfolder.current);
  /* v8 ignore start -- these are only read while the dialog is open, which takes a folder */
  const folderName = $derived(subfolder?.name ?? '');
  /** Assets in the folder, at any depth, which will be deleted along. */
  const assets = $derived(subfolder ? getSubfolderAssets(subfolder.path) : []);
  /* v8 ignore stop */
  const blocked = $derived(!!plan?.blockers.length);

  /**
   * Delete the folder.
   */
  const remove = async () => {
    /* v8 ignore next 3 -- the dialog is only open for a folder */
    if (!subfolder) {
      return;
    }

    try {
      await deleteSubfolder(subfolder.path);
    } catch (/** @type {any} */ ex) {
      deletionFailed = true;
      // eslint-disable-next-line no-console
      console.error(ex);
    }
  };

  // Work out the plan whenever the dialog opens. The lookup is asynchronous — an asset without a
  // public path is matched by its blob URL, which may have to be created first — so the dialog
  // starts without a plan, and the Delete button waits for it
  $effect(() => {
    if (!subfolder) {
      return;
    }

    const selection = assets;

    plan = undefined;
    open = true;

    planAssetDeletion(selection).then((result) => {
      // The dialog may have been reopened for another folder meanwhile
      /* v8 ignore next 3 -- the plan is worked out too quickly for a test to get in between */
      if (deletingSubfolder.current === subfolder) {
        plan = result;
      }
    });
  });
</script>

<ConfirmationDialog
  bind:open
  title={_('delete_folder')}
  okLabel={_('delete')}
  okDisabled={!plan || blocked}
  onOk={() => {
    // Don’t wait for the commit; the list is updated optimistically
    remove();
  }}
  onClose={() => {
    // The dialog is closed before the deletion is confirmed, so the folder is let go of here
    // rather than when `open` turns false
    deletingSubfolder.current = undefined;
  }}
>
  <!-- There’s nothing to confirm when the deletion is refused; the note explains why -->
  {#if !blocked}
    {_('confirm_deleting_folder', { values: { name: folderName, count: assets.length } })}
  {/if}
  {#if plan}
    <CascadeDeleteNote {plan} kind="asset" count={assets.length} />
  {/if}
</ConfirmationDialog>

<Toast bind:show={deletionFailed}>
  <Alert status="error">{_('deleting_folder_failed')}</Alert>
</Toast>
