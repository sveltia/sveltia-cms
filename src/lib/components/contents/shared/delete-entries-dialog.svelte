<script>
  import { ConfirmationDialog } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { selectedCollection, selectedEntries } from '$lib/services/contents';
  import { deleteEntries } from '$lib/services/contents/data';
  import { getAssociatedAssets } from '$lib/services/contents/entry';
  import { listedEntries } from '$lib/services/contents/view';

  export let open = false;

  $: associatedAssets =
    !!$selectedEntries.length && !!$selectedCollection?._assetFolder?.entryRelative
      ? $selectedEntries.map((entry) => getAssociatedAssets(entry, { relative: true })).flat(1)
      : [];
</script>

<ConfirmationDialog
  bind:open
  title={$selectedEntries.length === 1 ? $_('delete_entry') : $_('delete_entries')}
  okLabel={$_('delete')}
  on:ok={() => {
    deleteEntries(
      $selectedEntries.map(({ id }) => id),
      associatedAssets.map(({ path }) => path),
    );
  }}
>
  {#if $selectedEntries.length === 1}
    {$_(
      associatedAssets.length
        ? 'confirm_deleting_selected_entry_with_assets'
        : 'confirm_deleting_selected_entry',
    )}
  {:else if $selectedEntries.length === $listedEntries.length}
    {$_(
      associatedAssets.length
        ? 'confirm_deleting_all_entries_with_assets'
        : 'confirm_deleting_all_entries',
    )}
  {:else}
    {$_(
      associatedAssets.length
        ? 'confirm_deleting_selected_entries_with_assets'
        : 'confirm_deleting_selected_entries',
      { values: { count: $selectedEntries.length } },
    )}
  {/if}
</ConfirmationDialog>
