<!--
  @component
  Save/Cancel buttons shown in the collection toolbar while the entry list is in reorder mode. Owns
  the saving state and the error toast, so the parent toolbar only needs to render this component
  when `$reordering` is `true`.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Alert, Button, Toast } from '@sveltia/ui';

  import { selectedCollection } from '$lib/services/contents/collection';
  import { reorderEntries } from '$lib/services/contents/collection/entries/reorder';
  import {
    reorderDirty,
    reorderedEntries,
    reordering,
  } from '$lib/services/contents/collection/view';

  /**
   * @import { InternalEntryCollection } from '$lib/types/private';
   */

  let saving = $state(false);
  let errorToast = $state(false);
</script>

<Button
  variant="primary"
  label={_('done')}
  aria-label={_('done_reordering_entries')}
  disabled={saving || !$reorderDirty}
  onclick={async () => {
    const collection = /** @type {InternalEntryCollection} */ ($selectedCollection);

    saving = true;

    try {
      await reorderEntries(collection, $reorderedEntries);
      $reordering = false;
    } catch (/** @type {any} */ ex) {
      // eslint-disable-next-line no-console
      console.error(ex);
      errorToast = true;
    }

    saving = false;
  }}
/>
<Button
  variant="secondary"
  label={_('cancel')}
  aria-label={_('cancel_reordering_entries')}
  disabled={saving}
  onclick={() => {
    $reordering = false;
  }}
/>

<Toast bind:show={errorToast}>
  <Alert status="error">
    {_('saving_reorder_failed')}
  </Alert>
</Toast>
