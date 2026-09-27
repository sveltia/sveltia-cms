<script>
  import { _ } from '@sveltia/i18n';
  import { Alert, ConfirmationDialog, Toast } from '@sveltia/ui';

  import CascadeDeleteNote from '$lib/components/common/cascade-delete-note.svelte';
  import { selectedCollection } from '$lib/services/contents/collection';
  import {
    contentUpdatesToast,
    UPDATE_TOAST_DEFAULT_STATE,
  } from '$lib/services/contents/collection/data';
  import { deleteEntries } from '$lib/services/contents/collection/data/delete';
  import { selectedEntries } from '$lib/services/contents/collection/entries';
  import { listedEntries, listedUnpublishedEntries } from '$lib/services/contents/collection/view';
  import { getEntryRelativeAssets } from '$lib/services/contents/entry/assets';
  import {
    EMPTY_CASCADE_DELETE_PLAN,
    planCascadeDelete,
  } from '$lib/services/contents/entry/relations/cascade/delete';
  import { isWorkflowEnabled } from '$lib/services/workflow';
  import { deleteWorkflowEntries, discardWorkflowEntries } from '$lib/services/workflow/save';

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
  const associatedAssets = $derived.by(() => {
    const collectionName = selectedCollection.current?.name;

    return collectionName
      ? publishedEntries.flatMap((entry) => getEntryRelativeAssets({ entry, collectionName }))
      : [];
  });

  /**
   * Delete the selected entries, discarding any unpublished draft rather than committing a deletion
   * for it.
   */
  const deleteSelectedEntries = async () => {
    try {
      if (draftEntries.length) {
        await discardWorkflowEntries(draftEntries);
      }

      if (publishedEntries.length) {
        const collection = selectedCollection.current;

        if (collection && isWorkflowEnabled(collection)) {
          // Committing the removals straight to the configured branch would bypass review and be
          // rejected outright when the branch is protected
          // @see https://github.com/decaporg/decap-cms/issues/6610
          await deleteWorkflowEntries(
            publishedEntries.map((entry) => ({
              entry,
              collection: /** @type {any} */ (collection),
              assets: getEntryRelativeAssets({ entry, collectionName: collection.name }),
            })),
          );

          contentUpdatesToast.current = {
            ...UPDATE_TOAST_DEFAULT_STATE,
            deleted: true,
            deletionPending: true,
            count: publishedEntries.length,
          };
        } else {
          await deleteEntries(publishedEntries, associatedAssets);
        }
      }
    } catch (/** @type {any} */ ex) {
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
  <Alert status="error">{_('deleting_entry_failed')}</Alert>
</Toast>
