<!--
  @component
  Ask the user to confirm reverting the changes, restoring the default values or clearing the
  fields of the entry being edited, in a locale or in every locale, and take the action once
  confirmed. The action can’t be undone, other than by reverting the changes.
-->
<script>
  import { ConfirmationDialog } from '@sveltia/ui';

  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import { resetEntry } from '$lib/services/contents/draft/update/reset';
  import { revertChanges } from '$lib/services/contents/draft/update/revert';
  import { getResetConfirmation, getResetLabel } from '$lib/services/contents/editor/reset';

  /**
   * @import { InternalLocaleCode } from '$lib/types/private';
   * @import { ResetAction } from '$lib/services/contents/editor/reset';
   */

  /**
   * @typedef {object} Props
   * @property {boolean} open Whether the dialog is open.
   * @property {ResetAction} action Action to confirm. It’s kept while the dialog closes, so the
   * dialog doesn’t change its text meanwhile.
   * @property {InternalLocaleCode} [locale] Locale to take the action in. If omitted, the action
   * applies to every locale.
   * @property {() => void} [onClose] Function called once the dialog is closed, e.g. to move the
   * focus back to the menu button.
   */

  const entryDraft = getEntryDraftContext();

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    open = $bindable(false),
    action,
    locale = undefined,
    onClose = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  const label = $derived(getResetLabel(action, locale ? 'locale' : 'entry'));
</script>

<ConfirmationDialog
  bind:open
  title={label}
  okLabel={label}
  onOk={() => {
    const draft = entryDraft.current;

    /* v8 ignore next 3 -- the dialog is only opened while the draft is there */
    if (!draft) {
      return;
    }

    if (action === 'revert') {
      revertChanges({ draft, locale });
    } else {
      resetEntry({ draft, locale, restore: action === 'restore' });
    }
  }}
  onClose={() => {
    onClose?.();
  }}
>
  {getResetConfirmation(action, locale)}
</ConfirmationDialog>
