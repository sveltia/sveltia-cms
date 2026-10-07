<script>
  import { _ } from '@sveltia/i18n';
  import { Alert, ConfirmationDialog, Toast } from '@sveltia/ui';

  import CascadeDeleteNote from '$lib/components/common/cascade-delete-note.svelte';
  import { getErrorMessage } from '$lib/services/backends/git/shared/errors';
  import { selectedCollection } from '$lib/services/contents/collection';
  import {
    contentUpdatesToast,
    UPDATE_TOAST_DEFAULT_STATE,
  } from '$lib/services/contents/collection/data';
  import { selectedEntries } from '$lib/services/contents/collection/entries';
  import { listedEntries, listedUnpublishedEntries } from '$lib/services/contents/collection/view';
  import { getEntryRelativeAssets } from '$lib/services/contents/entry/assets';
  import {
    EMPTY_CASCADE_DELETE_PLAN,
    planCascadeDelete,
  } from '$lib/services/contents/entry/relations/cascade/delete';
  import { isWorkflowEnabled } from '$lib/services/workflow';
  import { deleteOrDiscardEntries } from '$lib/services/workflow/delete';

  /**
   * @import { Entry, UnpublishedEntry } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {boolean} [open] Whether the dialog is open.
   */

  /** @type {Props} */
  let { open = $bindable(false) } = $props();

  let showErrorToast = $state(false);
  let errorMessage = $state('');

  // Deleting an unpublished entry discards the draft instead of committing a deletion, so the two
  // kinds of entries have to be handled separately
  const draftEntries = $derived(
    /** @type {UnpublishedEntry[]} */ (
      selectedEntries.current.filter((entry) => 'workflow' in entry)
    ),
  );
  const publishedEntries = $derived(
    /** @type {Entry[]} */ (selectedEntries.current.filter((entry) => !('workflow' in entry))),
  );

  // What the deletion means for the entries referencing the published ones through Relation fields.
  // Only worked out while the dialog is open: it scans every entry that could hold a reference,
  // which is too much to do on every change of the selection
  const cascadePlan = $derived.by(() => {
    const collection = selectedCollection.current;

    return open && collection && publishedEntries.length
      ? planCascadeDelete({ collection, entries: publishedEntries })
      : EMPTY_CASCADE_DELETE_PLAN;
  });

  // Assets committed alongside an unpublished entry don’t exist on the configured branch yet, so
  // only look at the published entries here
  const publishedEntryAssets = $derived.by(() => {
    const collectionName = selectedCollection.current?.name;

    return publishedEntries.map((entry) => ({
      entry,
      assets: collectionName ? getEntryRelativeAssets({ entry, collectionName }) : [],
    }));
  });
  const associatedAssets = $derived(publishedEntryAssets.flatMap(({ assets }) => assets));

  /**
   * Delete the selected entries, discarding any unpublished draft rather than committing a deletion
   * for it.
   */
  const deleteSelectedEntries = async () => {
    try {
      const collection = selectedCollection.current;

      const toastState = await deleteOrDiscardEntries({
        drafts: draftEntries,
        items: publishedEntryAssets,
        collection,
        useWorkflow: isWorkflowEnabled(collection),
      });

      if (toastState) {
        contentUpdatesToast.current = { ...UPDATE_TOAST_DEFAULT_STATE, ...toastState };
      }
    } catch (/** @type {any} */ ex) {
      errorMessage = getErrorMessage(ex, 'deleting_entry_failed');
      showErrorToast = true;
      // eslint-disable-next-line no-console
      console.error(ex);

      return;
    }

    // Discarding a draft doesn’t change `listedEntries`, which is what normally resets the
    // selection, so clear it here to avoid a stale selection
    selectedEntries.current = [];
  };
</script>

<ConfirmationDialog
  bind:open
  title={_('delete_entries', { values: { count: selectedEntries.current.length } })}
  okLabel={_('delete')}
  okDisabled={!!cascadePlan.blockers.length}
  onOk={async () => {
    await deleteSelectedEntries();
  }}
>
  {@const all =
    selectedEntries.current.length > 1 &&
    selectedEntries.current.length ===
      listedEntries.current.length + listedUnpublishedEntries.current.length}
  <!-- There’s nothing to confirm when the deletion is refused; the note explains why -->
  {#if !cascadePlan.blockers.length}
    {_(
      associatedAssets.length
        ? all
          ? 'confirm_deleting_all_entries_with_assets'
          : 'confirm_deleting_selected_entries_with_assets'
        : all
          ? 'confirm_deleting_all_entries'
          : 'confirm_deleting_selected_entries',
      { values: { count: selectedEntries.current.length } },
    )}
    {#if draftEntries.length}
      {_(
        publishedEntries.length
          ? 'workflow.deleting_unpublished_note_some'
          : 'workflow.deleting_unpublished_note_all',
        { values: { count: draftEntries.length } },
      )}
    {/if}
  {/if}
  <CascadeDeleteNote plan={cascadePlan} count={publishedEntries.length} />
</ConfirmationDialog>

<Toast bind:show={showErrorToast}>
  <Alert status="error">{errorMessage}</Alert>
</Toast>
