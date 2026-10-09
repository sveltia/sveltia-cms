<!--
  @component
  Delete the entry being edited, or discard its unpublished changes, once the user has confirmed it
  in a dialog. The progress and any error are reported with a toast. Use `confirmDelete()` and
  `confirmDiscard()` to open the dialogs.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Alert, ConfirmationDialog, Toast } from '@sveltia/ui';

  import DeleteEntryDialog from '$lib/components/contents/details/delete-entry-dialog.svelte';
  import { getErrorMessage } from '$lib/services/backends/git/shared/errors';
  import {
    contentUpdatesToast,
    UPDATE_TOAST_DEFAULT_STATE,
  } from '$lib/services/contents/collection/data';
  import { deleteOrDiscardEntries } from '$lib/services/workflow/delete';
  import { getDiscardDialogStrings } from '$lib/services/workflow/dialogs';
  import { discardWorkflowEntry } from '$lib/services/workflow/save';

  /**
   * @import {
   * Asset,
   * Entry,
   * InternalCollection,
   * InternalCollectionFile,
   * UnpublishedEntry,
   * UpdateToastState,
   * } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {boolean} [deleting] Whether a deletion is in flight.
   * @property {InternalCollection | undefined} collection Collection of the entry.
   * @property {InternalCollectionFile | undefined} collectionFile Collection file, if the entry is
   * one.
   * @property {Entry | undefined} originalEntry The entry as it was opened.
   * @property {UnpublishedEntry | undefined} unpublishedEntry The entry’s pull request with
   * Editorial Workflow, if any.
   * @property {Asset[]} associatedAssets Assets stored alongside the entry, deleted along with it.
   * @property {boolean} discardsDraft Whether the deletion throws away an unpublished entry that
   * has never been published.
   * @property {boolean} useWorkflow Whether the removal goes through Editorial Workflow.
   * @property {boolean} pendingDeletion Whether the entry is awaiting deletion, in which case the
   * discard calls off the deletion.
   * @property {() => void} onDone Function called once the entry has been deleted or discarded, to
   * close the editor.
   * @property {() => void} onClose Function called once a dialog is closed, e.g. to move the focus
   * back to the menu button.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    deleting = $bindable(false),
    collection,
    collectionFile,
    originalEntry,
    unpublishedEntry,
    associatedAssets,
    discardsDraft,
    useWorkflow,
    pendingDeletion,
    onDone,
    onClose,
    /* eslint-enable prefer-const */
  } = $props();

  let showDeleteDialog = $state(false);
  let showDiscardDialog = $state(false);
  let showDeleteErrorToast = $state(false);
  let deleteErrorMessage = $state('');
  /** I18n key of the message shown while a deletion is in flight. */
  let progressMessage = $state('');

  // The discard dialog is only opened for an entry with a published version. Its text is kept as it
  // is when the discarded entry goes away, so it doesn’t change while the dialog is closing
  const discardDialogStrings = $derived(
    getDiscardDialogStrings({ pendingDeletion, publishedVersionExists: true }),
  );

  /**
   * Ask the user to confirm the deletion of the entry.
   */
  export const confirmDelete = () => {
    showDeleteDialog = true;
  };

  /**
   * Ask the user to confirm discarding the unpublished changes.
   */
  export const confirmDiscard = () => {
    showDiscardDialog = true;
  };

  /**
   * Run the given deletion action, then go back to the entry list. The action reports what happened
   * by returning a toast state, which is shown by the content library page: the editor is closed by
   * then, so a toast rendered here would go with it. Errors are reported with a toast and leave the
   * editor open.
   * @param {() => Promise<Partial<UpdateToastState> | undefined>} action Action to be performed.
   * @param {string} progressKey I18n key of the message shown while the action is in flight.
   */
  const runDeletion = async (action, progressKey) => {
    /** @type {Partial<UpdateToastState> | undefined} */
    let toastState;

    progressMessage = progressKey;
    deleting = true;

    try {
      toastState = await action();
    } catch (/** @type {any} */ ex) {
      deleteErrorMessage = getErrorMessage(ex, 'deleting_entry_failed');
      showDeleteErrorToast = true;
      // eslint-disable-next-line no-console
      console.error(ex);

      return;
    } finally {
      deleting = false;
    }

    if (toastState) {
      contentUpdatesToast.current = { ...UPDATE_TOAST_DEFAULT_STATE, count: 1, ...toastState };
    }

    onDone();
  };

  /**
   * Delete the entry. With Editorial Workflow the removal goes through a pull request like any
   * other change, so the entry stays on the site until that is published. An unpublished entry that
   * has never been published is discarded instead, because there’s nothing on the configured branch
   * to remove.
   */
  const deleteEntry = async () => {
    await runDeletion(
      () =>
        deleteOrDiscardEntries({
          drafts: discardsDraft ? [/** @type {UnpublishedEntry} */ (unpublishedEntry)] : [],
          // The option is only offered for an existing entry
          items: discardsDraft
            ? []
            : [{ entry: /** @type {Entry} */ (originalEntry), assets: associatedAssets }],
          collection,
          collectionFile,
          useWorkflow,
        }),
      'workflow.deleting_entry',
    );
  };

  /**
   * Discard the unpublished changes by closing the pull request, leaving the published version of
   * the entry untouched.
   */
  const discardChanges = async () => {
    await runDeletion(
      async () => {
        /* v8 ignore next 3 -- the option is only offered for an unpublished entry */
        if (unpublishedEntry) {
          await discardWorkflowEntry(unpublishedEntry);
        }

        return pendingDeletion ? { deletionCancelled: true } : { discarded: true };
      },
      pendingDeletion ? 'workflow.cancelling_deletion' : 'workflow.discarding_changes',
    );
  };
</script>

<DeleteEntryDialog
  bind:open={showDeleteDialog}
  {discardsDraft}
  {useWorkflow}
  withAssets={!!associatedAssets.length}
  onOk={async () => {
    await deleteEntry();
  }}
  {onClose}
/>

<ConfirmationDialog
  bind:open={showDiscardDialog}
  title={discardDialogStrings.title}
  okLabel={discardDialogStrings.label}
  onOk={async () => {
    await discardChanges();
  }}
  {onClose}
>
  {discardDialogStrings.message}
</ConfirmationDialog>

<!-- Shown while the request is in flight. The result is reported by the content library page,
because this toast goes away with the editor once the deletion has completed -->
{#if progressMessage}
  <Toast id={progressMessage} show={deleting} duration={0}>
    <Alert status="info">{_(progressMessage)}</Alert>
  </Toast>
{/if}

<Toast bind:show={showDeleteErrorToast}>
  <Alert status="error">{deleteErrorMessage}</Alert>
</Toast>
