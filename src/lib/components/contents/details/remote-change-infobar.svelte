<!--
  @component
  Notice shown at the top of the entry editor when someone else has changed or deleted the entry in
  the repository while the user has it open. The background checks bring such a change into the
  entry store; this compares the entry the draft was made from with the entry as it is now. The
  user can reload the entry to start from the new version, or carry on: their work is left alone
  either way, and saving asks before overwriting the other change. An entry stored in a file with
  the other entries can’t be reloaded or saved over the change; the user is asked to open it again
  from the entry list.
-->
<script>
  import { _, locale as appLocale } from '@sveltia/i18n';
  import { Button, ConfirmationDialog, Infobar } from '@sveltia/ui';

  import { isDraftModified } from '$lib/services/contents/draft';
  import { reloadDraft } from '$lib/services/contents/draft/reload';
  import { compareWithStore, describeConflict } from '$lib/services/contents/draft/save/conflict';
  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import { isWorkflowDraft } from '$lib/services/workflow';

  /**
   * @import { Entry } from '$lib/types/private';
   */

  const entryDraft = getEntryDraftContext();
  const draft = $derived(entryDraft.current);
  /**
   * The entry the draft was made from, if it’s one that the background checks watch: an existing
   * entry on the configured branch. A workflow draft lives on a branch of its own, which those
   * checks don’t look at; it’s compared with its branch when the draft is saved instead.
   */
  const originalEntry = $derived(
    draft && !draft.isNew && !isWorkflowDraft(draft) ? draft.originalEntry : undefined,
  );
  const conflict = $derived(originalEntry ? compareWithStore(originalEntry) : undefined);
  /**
   * The version of the entry the user has dismissed the notice for, so the notice comes back if the
   * entry is changed again. A deletion has no version; it’s dismissed for good. Raw, so the entry
   * object is kept as is and can be compared with the one in the store.
   * @type {Entry | 'deleted' | undefined}
   */
  let dismissedFor = $state.raw();
  let showReloadDialog = $state(false);

  const show = $derived(!!conflict && dismissedFor !== (conflict.entry ?? 'deleted'));

  /**
   * Start over from the entry as it is now on the branch.
   */
  const reload = async () => {
    /* v8 ignore next 3 -- only reachable if the entry was deleted while the dialog was open */
    if (!conflict?.entry) {
      return;
    }

    await reloadDraft({ entryDraft, entry: conflict.entry });
  };
</script>

{#if conflict && show}
  {@const { description, warning } = describeConflict(conflict, appLocale.current)}
  <Infobar
    status="warning"
    --sui-infobar-message-justify-content="center"
    onDismiss={() => {
      dismissedFor = conflict.entry ?? 'deleted';
    }}
  >
    {description}
    {warning}
    <!-- An entry stored in a file with the other entries is told by its position, so reloading it
    could load another entry that has moved there -->
    {#if conflict.type === 'modified' && conflict.canOverwrite}
      <Button
        variant="link"
        label={_('remote_change.reload_entry')}
        onclick={() => {
          // Nothing to lose unless the user has edited the entry
          if (isDraftModified(draft)) {
            showReloadDialog = true;
          } else {
            reload();
          }
        }}
      />
    {/if}
  </Infobar>
{/if}

<ConfirmationDialog
  bind:open={showReloadDialog}
  title={_('remote_change.reload_entry')}
  okLabel={_('remote_change.reload_entry')}
  onOk={async () => {
    await reload();
  }}
>
  {_('remote_change.confirm_reloading_entry')}
</ConfirmationDialog>
