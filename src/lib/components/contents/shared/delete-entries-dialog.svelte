<script>
  import { _ } from '@sveltia/i18n';
  import { ConfirmationDialog } from '@sveltia/ui';

  import { getAssetFolder } from '$lib/services/assets/folders';
  import { selectedCollection } from '$lib/services/contents/collection';
  import { deleteEntries } from '$lib/services/contents/collection/data/delete';
  import { selectedEntries } from '$lib/services/contents/collection/entries';
  import { listedEntries } from '$lib/services/contents/collection/view';
  import { getAssociatedAssets } from '$lib/services/contents/entry/assets';

  /**
   * @typedef {object} Props
   * @property {boolean} [open] Whether the dialog is open.
   */

  /** @type {Props} */
  let { open = $bindable(false) } = $props();

  const associatedAssets = $derived.by(() => {
    const collectionName = $selectedCollection?.name;

    if (
      $selectedEntries.length &&
      collectionName &&
      getAssetFolder({ collectionName })?.entryRelative
    ) {
      return $selectedEntries.flatMap((entry) =>
        getAssociatedAssets({ entry, collectionName, relative: true }),
      );
    }

    return [];
  });
</script>

<ConfirmationDialog
  bind:open
  title={_('delete_entries', { values: { count: $selectedEntries.length } })}
  okLabel={_('delete')}
  onOk={() => {
    deleteEntries($selectedEntries, associatedAssets);
  }}
>
  {@const all = $selectedEntries.length > 1 && $selectedEntries.length === $listedEntries.length}
  {_(
    associatedAssets.length
      ? all
        ? 'confirm_deleting_all_entries_with_assets'
        : 'confirm_deleting_selected_entries_with_assets'
      : all
        ? 'confirm_deleting_all_entries'
        : 'confirm_deleting_selected_entries',
    { values: { count: $selectedEntries.length } },
  )}
</ConfirmationDialog>
