<script>
  import { _ } from '@sveltia/i18n';
  import { Button, ConfirmationDialog, Spacer } from '@sveltia/ui';

  import { duplicates } from '$lib/services/contents/fields/file/duplicates.svelte';
</script>

<ConfirmationDialog
  bind:open={duplicates.showDialog}
  title={_('file_name_conflict_resolution')}
  onCancel={() => duplicates.resolve(undefined)}
>
  {_('file_name_conflict_confirmation_with_name', {
    values: { count: duplicates.count, name: duplicates.name },
  })}
  {#snippet footer()}
    <Spacer flex />
    <Button variant="primary" onclick={() => duplicates.resolve(true)}>{_('replace')}</Button>
    <Button variant="primary" onclick={() => duplicates.resolve(false)}>{_('keep_both')}</Button>
    <Button variant="secondary" onclick={() => duplicates.resolve(undefined)}>{_('cancel')}</Button>
  {/snippet}
</ConfirmationDialog>
