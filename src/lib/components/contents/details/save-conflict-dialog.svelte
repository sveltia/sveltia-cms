<!--
  @component
  Tell the user that someone else has changed or removed the entry since it was opened, and offer
  to save over the change when that’s possible. An entry stored in a file with the other entries
  can’t be saved over the change, so the dialog only tells what happened.
-->
<script>
  import { _, locale as appLocale } from '@sveltia/i18n';
  import { AlertDialog, ConfirmationDialog } from '@sveltia/ui';

  import { describeConflict } from '$lib/services/contents/draft/save/conflict';

  /**
   * @import { EntryConflict } from '$lib/services/contents/draft/save/conflict';
   */

  /**
   * @typedef {object} Props
   * @property {boolean} open Whether the dialog is open.
   * @property {EntryConflict | undefined} conflict Someone else’s change to the entry.
   * @property {() => Promise<void>} onOverwrite Function called once the user agrees to save over
   * the change.
   * @property {() => void} onClose Function called once the dialog is closed, e.g. to move the
   * focus back to the menu button.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    open = $bindable(false),
    conflict,
    onOverwrite,
    onClose,
    /* eslint-enable prefer-const */
  } = $props();
</script>

{#snippet conflictDescription()}
  {#if conflict}
    {@const { description, warning } = describeConflict(conflict, appLocale.current)}
    {description}
    {warning}
  {/if}
{/snippet}

{#if conflict?.canOverwrite === false}
  <AlertDialog bind:open title={_('save_conflict.title')} {onClose}>
    {@render conflictDescription()}
  </AlertDialog>
{:else}
  <ConfirmationDialog
    bind:open
    title={_('save_conflict.title')}
    okLabel={_('save_conflict.save_anyway')}
    onOk={onOverwrite}
    {onClose}
  >
    {@render conflictDescription()}
  </ConfirmationDialog>
{/if}
