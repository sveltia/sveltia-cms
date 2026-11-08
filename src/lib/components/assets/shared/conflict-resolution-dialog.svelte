<script>
  import { _ } from '@sveltia/i18n';
  import { Button, ConfirmationDialog, Spacer } from '@sveltia/ui';

  import { duplicatesRequest } from '$lib/services/contents/fields/file/duplicates.svelte';

  /* v8 ignore start -- these are only read while the dialog is open, when there’s a request */
  const { count, name } = $derived(duplicatesRequest.current ?? { count: 0, name: '' });
  /* v8 ignore stop */

  /**
   * Answer the pending request.
   * @param {boolean | undefined} replace Whether to replace the existing files, or `undefined` to
   * cancel.
   */
  const respond = (replace) => {
    duplicatesRequest.current?.respond(replace);
  };
</script>

<ConfirmationDialog
  open={!!duplicatesRequest.current}
  title={_('file_name_conflict_resolution')}
  onCancel={() => respond(undefined)}
>
  {_('file_name_conflict_confirmation_with_name', { values: { count, name } })}
  {#snippet footer()}
    <Spacer flex />
    <Button variant="primary" onclick={() => respond(true)}>{_('replace')}</Button>
    <Button variant="primary" onclick={() => respond(false)}>{_('keep_both')}</Button>
    <Button variant="secondary" onclick={() => respond(undefined)}>{_('cancel')}</Button>
  {/snippet}
</ConfirmationDialog>
