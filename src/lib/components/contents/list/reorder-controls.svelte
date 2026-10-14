<!--
  @component
  Save/Cancel buttons shown in the collection toolbar while the entry list is in reorder mode. Owns
  the saving state and the error toast, so the parent toolbar only needs to render this component
  when `reordering.current` is `true`.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Alert, Button, Toast } from '@sveltia/ui';
  import { tick } from 'svelte';

  import { isCommitCancelled } from '$lib/services/backends/commit-prompt';
  import { selectedCollection } from '$lib/services/contents/collection';
  import { reorderEntries } from '$lib/services/contents/collection/entries/reorder';
  import {
    reorderDirty,
    reorderedEntries,
    setReorderMode,
  } from '$lib/services/contents/collection/view';

  /**
   * @import { InternalEntryCollection } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {() => void} [onExit] Called once the reorder mode has been left, so the parent can
   * move the focus to the button that took the place of these.
   */

  /** @type {Props} */
  const { onExit = undefined } = $props();

  let saving = $state(false);
  let errorToast = $state(false);
  /** @type {HTMLButtonElement | undefined} */
  let doneButton = $state();
  /** @type {HTMLButtonElement | undefined} */
  let cancelButton = $state();

  /**
   * Move the focus to the Done button, or the Cancel button while there is nothing to save, e.g.
   * once the reorder mode has been entered with the button these take the place of.
   */
  export const focus = () => {
    const done = /** @type {HTMLButtonElement} */ (doneButton);

    /** @type {HTMLButtonElement} */ (done.disabled ? cancelButton : done).focus();
  };

  /**
   * Leave the reorder mode.
   */
  const exit = () => {
    setReorderMode(false);
    onExit?.();
  };
</script>

<Button
  bind:element={doneButton}
  variant="primary"
  label={_('done')}
  aria-label={_('done_reordering_entries')}
  disabled={saving || !reorderDirty.current}
  onclick={async () => {
    const collection = /** @type {InternalEntryCollection} */ (selectedCollection.current);

    saving = true;

    try {
      await reorderEntries(collection, reorderedEntries.current);
      saving = false;
      exit();
    } catch (/** @type {any} */ ex) {
      // The user has cancelled the commit at the commit message prompt, which isn’t a failure
      if (!isCommitCancelled(ex)) {
        // eslint-disable-next-line no-console
        console.error(ex);
        errorToast = true;
      }

      saving = false;
      // The button lost the focus while it was disabled during the save, so give it back
      await tick();
      /** @type {HTMLButtonElement} */ (doneButton).focus();
    }
  }}
/>
<Button
  bind:element={cancelButton}
  variant="secondary"
  label={_('cancel')}
  aria-label={_('cancel_reordering_entries')}
  disabled={saving}
  onclick={() => {
    exit();
  }}
/>

<Toast bind:show={errorToast}>
  <Alert status="error">
    {_('saving_reorder_failed')}
  </Alert>
</Toast>
