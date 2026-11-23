<!--
  @component
  Save/Cancel buttons shown in the collection toolbar while the entry list is in reorder mode. Owns
  the saving state and the error toast, so the parent toolbar only needs to render this component
  when `reordering.current` is `true`.
-->
<script>
  import { _ } from '@sveltia/i18n';

  import ListModeControls from '$lib/components/contents/list/list-mode-controls.svelte';
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

  /** @type {ListModeControls | undefined} */
  let controls = $state();

  /**
   * Move the focus to the Done button, or the Cancel button while there is nothing to save, e.g.
   * once the reorder mode has been entered with the button these take the place of.
   */
  export const focus = () => {
    /** @type {ListModeControls} */ (controls).focus();
  };
</script>

<ListModeControls
  bind:this={controls}
  saveLabel={_('done')}
  saveAriaLabel={_('done_reordering_entries')}
  cancelAriaLabel={_('cancel_reordering_entries')}
  savingFailedMessage={_('saving_reorder_failed')}
  canSave={reorderDirty.current}
  commit={() =>
    reorderEntries(
      /** @type {InternalEntryCollection} */ (selectedCollection.current),
      reorderedEntries.current,
    )}
  exitMode={() => setReorderMode(false)}
  {onExit}
/>
