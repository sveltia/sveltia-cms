<!--
  @component
  Save/Cancel buttons shown in the collection toolbar while the entry list is in a mode that makes
  pending changes, such as the bulk edit or reorder mode. Owns the saving flow, the error toasts
  and, optionally, the validation step and the confirmation to discard unsaved changes.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Alert, Button, ConfirmationDialog, Toast } from '@sveltia/ui';
  import { tick } from 'svelte';

  import { runCommit } from '$lib/services/backends/commit-prompt';

  /**
   * @typedef {object} Props
   * @property {string} saveLabel Visible label of the primary button.
   * @property {string} saveAriaLabel Accessible name of the primary button.
   * @property {string} cancelAriaLabel Accessible name of the Cancel button, also the title of the
   * discard confirmation.
   * @property {string} savingFailedMessage Message of the toast shown when saving fails.
   * @property {() => Promise<unknown>} commit Save the pending changes.
   * @property {() => void} exitMode Leave the mode.
   * @property {boolean} [canSave] Whether there is anything to save.
   * @property {boolean} [saving] Whether the changes are being saved. Bindable.
   * @property {() => boolean} [validate] Check the pending changes before saving. Returns `false`
   * to stop the save and show the `invalidMessage` toast.
   * @property {string} [invalidMessage] Message of the toast shown when `validate` fails.
   * @property {string} [discardMessage] Message of the confirmation asked before leaving the mode
   * with unsaved changes. Without it, the Cancel button leaves the mode straight away.
   * @property {() => void} [onExit] Called once the mode has been left, so the parent can move the
   * focus to the button that took the place of these.
   * @property {import('svelte').Snippet} [leading] Content shown before the buttons.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    saveLabel,
    saveAriaLabel,
    cancelAriaLabel,
    savingFailedMessage,
    commit,
    exitMode,
    canSave = true,
    saving = $bindable(false),
    validate = undefined,
    invalidMessage = '',
    discardMessage = '',
    onExit = undefined,
    leading = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  let showDiscardDialog = $state(false);
  let invalidToast = $state(false);
  let errorToast = $state(false);
  /** @type {HTMLButtonElement | undefined} */
  let saveButton = $state();
  /** @type {HTMLButtonElement | undefined} */
  let cancelButton = $state();

  /**
   * Move the focus to the primary button, or the Cancel button while there is nothing to save, e.g.
   * once the mode has been entered with the button these take the place of.
   */
  export const focus = () => {
    const save = /** @type {HTMLButtonElement} */ (saveButton);

    /** @type {HTMLButtonElement} */ (save.disabled ? cancelButton : save).focus();
  };

  /**
   * Leave the mode.
   */
  const exit = () => {
    exitMode();
    onExit?.();
  };

  /**
   * Validate and save the pending changes, then leave the mode.
   */
  const save = async () => {
    if (validate && !validate()) {
      invalidToast = true;

      return;
    }

    saving = true;

    const { ok, cancelled } = await runCommit(commit);

    saving = false;

    if (ok) {
      exit();
    } else {
      // A cancellation at the commit message prompt isn’t a failure
      if (!cancelled) {
        errorToast = true;
      }

      // The button lost the focus while it was disabled during the save, so give it back
      await tick();
      /** @type {HTMLButtonElement} */ (saveButton).focus();
    }
  };
</script>

{@render leading?.()}
<Button
  bind:element={saveButton}
  variant="primary"
  label={saveLabel}
  aria-label={saveAriaLabel}
  disabled={saving || !canSave}
  onclick={() => {
    save();
  }}
/>
<Button
  bind:element={cancelButton}
  variant="secondary"
  label={_('cancel')}
  aria-label={cancelAriaLabel}
  disabled={saving}
  onclick={() => {
    if (discardMessage && canSave) {
      showDiscardDialog = true;
    } else {
      exit();
    }
  }}
/>

{#if discardMessage}
  <ConfirmationDialog
    bind:open={showDiscardDialog}
    title={cancelAriaLabel}
    okLabel={_('discard')}
    onOk={() => {
      exit();
    }}
  >
    {discardMessage}
  </ConfirmationDialog>
{/if}

{#if invalidMessage}
  <Toast bind:show={invalidToast}>
    <Alert status="error">
      {invalidMessage}
    </Alert>
  </Toast>
{/if}

<Toast bind:show={errorToast}>
  <Alert status="error">
    {savingFailedMessage}
  </Alert>
</Toast>
