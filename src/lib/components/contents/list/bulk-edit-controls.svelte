<!--
  @component
  Save/Cancel buttons shown in the collection toolbar while the entry list is in bulk edit mode.
  Owns the saving flow, the confirmation to discard unsaved edits and the error toasts, so the
  parent toolbar only needs to render this component when `bulkEditing.current` is `true`.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Spacer } from '@sveltia/ui';

  import ListModeControls from '$lib/components/contents/list/list-mode-controls.svelte';
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

  /** @type {ListModeControls | undefined} */
  let controls = $state();

  const count = $derived(countBulkEdits(bulkEdits.current));

  /**
   * Move the focus to the Save button, or the Cancel button while there is nothing to save, e.g.
   * once the bulk edit mode has been entered with the button these take the place of.
   */
  export const focus = () => {
    /** @type {ListModeControls} */ (controls).focus();
  };

  /**
   * Get the arguments of the bulk edit functions.
   * @returns {Parameters<typeof saveBulkEdits>[0]} Arguments.
   */
  const getArgs = () => ({
    collection: /** @type {InternalEntryCollection} */ (selectedCollection.current),
    entries: bulkEditedEntries.current,
    edits: bulkEdits.current,
  });
</script>

<ListModeControls
  bind:this={controls}
  bind:saving={bulkEditSaving.current}
  saveLabel={_('save')}
  saveAriaLabel={_('save_bulk_edits')}
  cancelAriaLabel={_('cancel_bulk_edits')}
  savingFailedMessage={_('saving_bulk_edits_failed')}
  invalidMessage={_('bulk_edit_invalid')}
  discardMessage={_('discard_bulk_edits_confirm')}
  canSave={!!count}
  validate={() => {
    const errors = validateBulkEdits(getArgs());

    if (Object.keys(errors).length) {
      bulkEditErrors.current = errors;

      return false;
    }

    return true;
  }}
  commit={() => saveBulkEdits(getArgs())}
  exitMode={() => setBulkEditMode(false)}
  {onExit}
>
  {#snippet leading()}
    <div role="status" class="count">{_('bulk_edit_count', { values: { count } })}</div>
    <Spacer />
  {/snippet}
</ListModeControls>

<style>
  .count {
    font-size: var(--sui-font-size-small);
    opacity: 0.8;
    white-space: nowrap;
  }
</style>
