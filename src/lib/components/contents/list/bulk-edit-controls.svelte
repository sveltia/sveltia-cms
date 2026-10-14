<!--
  @component
  Save/Cancel buttons shown in the collection toolbar while the entry list is in bulk edit mode.
  Owns the saving flow, the confirmation to discard unsaved edits and the error toasts, so the
  parent toolbar only needs to render this component when `bulkEditing.current` is `true`.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Alert, Button, ConfirmationDialog, Spacer, Toast } from '@sveltia/ui';
  import { tick } from 'svelte';

  import { isCommitCancelled } from '$lib/services/backends/commit-prompt';
  import { selectedCollection } from '$lib/services/contents/collection';
  import {
    countBulkEdits,
    saveBulkEdits,
    validateBulkEdits,
  } from '$lib/services/contents/collection/entries/bulk-edit';
  import {
    bulkEditedEntries,
    bulkEditErrors,
    bulkEdits,
    bulkEditSaving,
    setBulkEditMode,
  } from '$lib/services/contents/collection/view';

  /**
   * @import { InternalEntryCollection } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {() => void} [onExit] Called once the bulk edit mode has been left, so the parent can
   * move the focus to the button that took the place of these.
   */

  /** @type {Props} */
  const { onExit = undefined } = $props();

  let showDiscardDialog = $state(false);
  let invalidToast = $state(false);
  let errorToast = $state(false);
  /** @type {HTMLButtonElement | undefined} */
  let saveButton = $state();
  /** @type {HTMLButtonElement | undefined} */
  let cancelButton = $state();

  const count = $derived(countBulkEdits(bulkEdits.current));

  /**
   * Move the focus to the Save button, or the Cancel button while there is nothing to save, e.g.
   * once the bulk edit mode has been entered with the button these take the place of.
   */
  export const focus = () => {
    const save = /** @type {HTMLButtonElement} */ (saveButton);

    /** @type {HTMLButtonElement} */ (save.disabled ? cancelButton : save).focus();
  };

  /**
   * Leave the bulk edit mode.
   */
  const exit = () => {
    setBulkEditMode(false);
    onExit?.();
  };

  /**
   * Validate and save the pending edits, then leave the bulk edit mode.
   */
  const save = async () => {
    const collection = /** @type {InternalEntryCollection} */ (selectedCollection.current);
    const args = { collection, entries: bulkEditedEntries.current, edits: bulkEdits.current };
    const errors = validateBulkEdits(args);

    if (Object.keys(errors).length) {
      bulkEditErrors.current = errors;
      invalidToast = true;

      return;
    }

    bulkEditSaving.current = true;

    try {
      await saveBulkEdits(args);
      bulkEditSaving.current = false;
      exit();
    } catch (/** @type {any} */ ex) {
      // The user has cancelled the commit at the commit message prompt, which isn’t a failure
      if (!isCommitCancelled(ex)) {
        // eslint-disable-next-line no-console
        console.error(ex);
        errorToast = true;
      }

      bulkEditSaving.current = false;
      // The button lost the focus while it was disabled during the save, so give it back
      await tick();
      /** @type {HTMLButtonElement} */ (saveButton).focus();
    }
  };
</script>

<div role="status" class="count">{_('bulk_edit_count', { values: { count } })}</div>
<Spacer />
<Button
  bind:element={saveButton}
  variant="primary"
  label={_('save')}
  aria-label={_('save_bulk_edits')}
  disabled={bulkEditSaving.current || !count}
  onclick={() => {
    save();
  }}
/>
<Button
  bind:element={cancelButton}
  variant="secondary"
  label={_('cancel')}
  aria-label={_('cancel_bulk_edits')}
  disabled={bulkEditSaving.current}
  onclick={() => {
    if (count) {
      showDiscardDialog = true;
    } else {
      exit();
    }
  }}
/>

<ConfirmationDialog
  bind:open={showDiscardDialog}
  title={_('cancel_bulk_edits')}
  okLabel={_('discard')}
  onOk={() => {
    exit();
  }}
>
  {_('discard_bulk_edits_confirm')}
</ConfirmationDialog>

<Toast bind:show={invalidToast}>
  <Alert status="error">
    {_('bulk_edit_invalid')}
  </Alert>
</Toast>

<Toast bind:show={errorToast}>
  <Alert status="error">
    {_('saving_bulk_edits_failed')}
  </Alert>
</Toast>

<style>
  .count {
    font-size: var(--sui-font-size-small);
    opacity: 0.8;
    white-space: nowrap;
  }
</style>
