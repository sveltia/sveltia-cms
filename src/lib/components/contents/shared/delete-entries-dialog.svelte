<script>
  import { _ } from '@sveltia/i18n';
  import { Alert, ConfirmationDialog, Toast } from '@sveltia/ui';

  import { getAssetFolder } from '$lib/services/assets/folders';
  import { selectedCollection } from '$lib/services/contents/collection';
  import {
    contentUpdatesToast,
    UPDATE_TOAST_DEFAULT_STATE,
  } from '$lib/services/contents/collection/data';
  import { deleteEntries } from '$lib/services/contents/collection/data/delete';
  import { selectedEntries } from '$lib/services/contents/collection/entries';
  import { listedEntries, listedUnpublishedEntries } from '$lib/services/contents/collection/view';
  import { getAssociatedAssets } from '$lib/services/contents/entry/assets';
  import { workflowEnabled } from '$lib/services/workflow';
  import { deleteWorkflowEntries, discardWorkflowEntries } from '$lib/services/workflow/save';

  /**
   * @import { Asset, Entry, UnpublishedEntry } from '$lib/types/private';
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
    /** @type {UnpublishedEntry[]} */ ($selectedEntries.filter((entry) => 'workflow' in entry)),
  );
  const publishedEntries = $derived(
    /** @type {Entry[]} */ ($selectedEntries.filter((entry) => !('workflow' in entry))),
  );

  /**
   * Get the assets stored alongside the given entry, which are removed with it.
   * @param {Entry} entry Entry to look at.
   * @returns {Asset[]} Assets, or an empty list unless the collection stores them with the entry.
   */
  const getEntryAssets = (entry) => {
    const collectionName = $selectedCollection?.name;

    return collectionName && getAssetFolder({ collectionName })?.entryRelative
      ? getAssociatedAssets({ entry, collectionName, relative: true })
      : [];
  };

  const associatedAssets = $derived.by(() => {
    const collectionName = $selectedCollection?.name;

    // Assets committed alongside an unpublished entry don’t exist on the configured branch yet, so
    // only look at the published entries here
    if (
      publishedEntries.length &&
      collectionName &&
      getAssetFolder({ collectionName })?.entryRelative
    ) {
      return publishedEntries.flatMap((entry) =>
        getAssociatedAssets({ entry, collectionName, relative: true }),
      );
    }

    return [];
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
        if ($workflowEnabled && $selectedCollection) {
          // Committing the removals straight to the configured branch would bypass review and be
          // rejected outright when the branch is protected
          // @see https://github.com/decaporg/decap-cms/issues/6610
          await deleteWorkflowEntries(
            publishedEntries.map((entry) => ({
              entry,
              collection: /** @type {any} */ ($selectedCollection),
              assets: getEntryAssets(entry),
            })),
          );

          contentUpdatesToast.set({
            ...UPDATE_TOAST_DEFAULT_STATE,
            deleted: true,
            deletionPending: true,
            count: publishedEntries.length,
          });
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
    $selectedEntries = [];
  };
</script>

<ConfirmationDialog
  bind:open
  title={_('delete_entries', { values: { count: $selectedEntries.length } })}
  okLabel={_('delete')}
  onOk={async () => {
    await deleteSelectedEntries();
  }}
>
  {@const all =
    $selectedEntries.length > 1 &&
    $selectedEntries.length === $listedEntries.length + $listedUnpublishedEntries.length}
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
  {#if draftEntries.length}
    {_(
      publishedEntries.length
        ? 'workflow.deleting_unpublished_note_some'
        : 'workflow.deleting_unpublished_note_all',
      { values: { count: draftEntries.length } },
    )}
  {/if}
</ConfirmationDialog>

<Toast bind:show={showErrorToast}>
  <Alert status="error">{_('deleting_entry_failed')}</Alert>
</Toast>
