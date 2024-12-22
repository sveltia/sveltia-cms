<script>
  import { ConfirmationDialog } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { selectedCollection } from '$lib/services/contents/collection';
  import { deleteEntries } from '$lib/services/contents/collection/data';
  import { selectedEntries } from '$lib/services/contents/collection/entries';
  import { listedEntries } from '$lib/services/contents/collection/view';
  import { getAssociatedAssets } from '$lib/services/contents/entry/assets';

  /**
   * @typedef {object} Props
   * @property {boolean} [open] - Whether the dialog is open.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    open = $bindable(false),
    /* eslint-enable prefer-const */
  } = $props();

  const associatedAssets = $derived.by(() => {
    if (!!$selectedEntries.length && !!$selectedCollection?._assetFolder?.entryRelative) {
      const collectionName = $selectedCollection.name;

      return $selectedEntries
        .map((entry) => getAssociatedAssets({ entry, collectionName, relative: true }))
        .flat(1);
    }

    return [];
  });
</script>

<ConfirmationDialog
  bind:open
  title={$selectedEntries.length === 1 ? $_('delete_entry') : $_('delete_entries')}
  okLabel={$_('delete')}
  onOk={() => {
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
