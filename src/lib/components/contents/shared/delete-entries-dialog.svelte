<script>
  import { ConfirmationDialog } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { selectedEntries } from '$lib/services/contents';
  import { deleteEntries } from '$lib/services/contents/data';
  import { listedEntries } from '$lib/services/contents/view';

  export let open = false;
</script>

<ConfirmationDialog
  bind:open
  title={$selectedEntries.length === 1 ? $_('delete_entry') : $_('delete_entries')}
  okLabel={$_('delete')}
  on:ok={() => {
    deleteEntries($selectedEntries.map(({ id }) => id));
  }}
>
  {#if $selectedEntries.length === 1}
    {$_('confirm_deleting_selected_entry')}
  {:else if $selectedEntries.length === $listedEntries.length}
    {$_('confirm_deleting_all_entries')}
  {:else}
    {$_('confirm_deleting_selected_entries', { values: { count: $selectedEntries.length } })}
  {/if}
</ConfirmationDialog>
