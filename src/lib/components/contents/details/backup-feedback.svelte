<script>
  import { _, locale as appLocale } from '@sveltia/i18n';
  import { Alert, ConfirmationDialog, Toast } from '@sveltia/ui';

  import { backupToastState, restoreDialogState } from '$lib/services/contents/draft/backup';
  import { showContentOverlay } from '$lib/services/contents/editor';

  const now = $derived(new Date());
  const { resolve, timestamp } = $derived(restoreDialogState.current);
  const sameYear = $derived(now.getUTCFullYear() === timestamp?.getUTCFullYear());
  const sameMonth = $derived(sameYear && now.getUTCMonth() === timestamp?.getUTCMonth());
  const sameDay = $derived(sameMonth && now.getUTCDate() === timestamp?.getUTCDate());
  const datetime = $derived(
    timestamp?.toLocaleString(appLocale.current, {
      year: sameYear ? undefined : 'numeric',
      month: sameDay ? undefined : 'short',
      day: sameDay ? undefined : 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    }),
  );

  $effect(() => {
    if (!showContentOverlay.current && restoreDialogState.current.show) {
      // Close the dialog when the Content Editor is closed
      restoreDialogState.current.show = false;
      resolve?.();
    }
  });
</script>

<ConfirmationDialog
  bind:open={restoreDialogState.current.show}
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
