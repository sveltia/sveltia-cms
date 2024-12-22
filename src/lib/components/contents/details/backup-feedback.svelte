<script>
  import { Alert, ConfirmationDialog, Toast } from '@sveltia/ui';
  import { _, locale as appLocale } from 'svelte-i18n';
  import { backupToastState, restoreDialogState } from '$lib/services/contents/draft/backup';
  import { showContentOverlay } from '$lib/services/contents/draft/editor';

  const now = $derived(new Date());
  const { resolve, timestamp } = $derived($restoreDialogState);
  const sameYear = $derived(now.getUTCFullYear() === timestamp?.getUTCFullYear());
  const sameMonth = $derived(sameYear && now.getUTCMonth() === timestamp?.getUTCMonth());
  const sameDay = $derived(sameMonth && now.getUTCDate() === timestamp?.getUTCDate());
  const datetime = $derived(
    timestamp?.toLocaleString($appLocale ?? undefined, {
      year: sameYear ? undefined : 'numeric',
      month: sameDay ? undefined : 'short',
      day: sameDay ? undefined : 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    }),
  );

  $effect(() => {
    if (!$showContentOverlay && $restoreDialogState.show) {
      // Close the dialog when the Content Editor is closed
      $restoreDialogState.show = false;
      resolve?.();
    }
  });
</script>

<ConfirmationDialog
  bind:open={$restoreDialogState.show}
  title={$_('restore_backup_title')}
  okLabel={$_('restore')}
  cancelLabel={$_('discard')}
  onOk={() => {
    resolve?.(true);
  }}
  onCancel={() => {
    resolve?.(false);
  }}
>
  {$_('restore_backup_description', { values: { datetime } })}
</ConfirmationDialog>

<Toast bind:show={$backupToastState.saved}>
  <Alert status="info">
    {$_('draft_backup_saved')}
  </Alert>
</Toast>

<Toast bind:show={$backupToastState.restored}>
  <Alert status="success">
    {$_('draft_backup_restored')}
  </Alert>
</Toast>

<Toast bind:show={$backupToastState.deleted}>
  <Alert status="info">
    {$_('draft_backup_deleted')}
  </Alert>
</Toast>
