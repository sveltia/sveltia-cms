<script>
  import { _, locale as appLocale } from '@sveltia/i18n';
  import { Alert, ConfirmationDialog, Toast } from '@sveltia/ui';

  import {
    backupToastState,
    cancelRestoreCheck,
    restoreDialogState,
  } from '$lib/services/contents/draft/backup';
  import { showContentOverlay } from '$lib/services/contents/editor';
  import { formatRecentDateTime } from '$lib/services/utils/date';

  const { resolve } = $derived(restoreDialogState.current);
  /* v8 ignore start -- the time is only read while the dialog is shown, which has a timestamp */
  // The dialog state is replaced whenever the dialog is opened, so the backup time is compared with
  // the time it’s opened, while this component stays mounted with the Content Library
  const datetime = $derived.by(() => {
    const { timestamp } = restoreDialogState.current;

    return timestamp ? formatRecentDateTime({ timestamp, locale: appLocale.current }) : undefined;
  });
  /* v8 ignore stop */

  $effect(() => {
    if (!showContentOverlay.current) {
      // Close the dialog when the Content Editor is closed, or keep it from opening
      cancelRestoreCheck();
    }
  });
</script>

<!-- Neither modal nor fixed in place, so the user can look through the entry, which is read-only
meanwhile, before deciding. The backdrop only dims the editor to draw attention to the dialog; the
entry can still be scrolled through it -->
<ConfirmationDialog
  bind:open={restoreDialogState.current.show}
  modal={false}
  showBackdrop
  movable
  title={_('restore_backup_title')}
  okLabel={_('restore')}
  cancelLabel={_('discard')}
  onOk={() => {
    resolve?.(true);
  }}
  onCancel={() => {
    resolve?.(false);
  }}
>
  {_('restore_backup_description', { values: { datetime } })}
</ConfirmationDialog>

<Toast bind:show={backupToastState.current.saved}>
  <Alert status="info">
    {_('draft_backup_saved')}
  </Alert>
</Toast>

<Toast bind:show={backupToastState.current.restored}>
  <Alert status="success">
    {_('draft_backup_restored')}
  </Alert>
</Toast>

<Toast bind:show={backupToastState.current.deleted}>
  <Alert status="info">
    {_('draft_backup_deleted')}
  </Alert>
</Toast>
