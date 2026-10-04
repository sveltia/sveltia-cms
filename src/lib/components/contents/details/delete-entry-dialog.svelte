<!--
  @component
  Ask the user to confirm the deletion of the entry being edited, explaining what it means for the
  entry and for the entries referencing it through Relation fields. The deletion is refused when
  it would leave another entry invalid.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { ConfirmationDialog } from '@sveltia/ui';

  import CascadeDeleteNote from '$lib/components/common/cascade-delete-note.svelte';
  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import {
    EMPTY_CASCADE_DELETE_PLAN,
    planCascadeDelete,
  } from '$lib/services/contents/entry/relations/cascade/delete';

  /**
   * @typedef {object} Props
   * @property {boolean} open Whether the dialog is open.
   * @property {boolean} discardsDraft Whether the deletion throws away an unpublished entry that
   * has never been published.
   * @property {boolean} useWorkflow Whether the removal goes through Editorial Workflow.
   * @property {boolean} withAssets Whether the assets stored alongside the entry are deleted too.
   * @property {() => Promise<void>} onOk Function called once the deletion is confirmed.
   * @property {() => void} onClose Function called once the dialog is closed, e.g. to move the
   * focus back to the menu button.
   */

  const entryDraft = getEntryDraftContext();

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    open = $bindable(false),
    discardsDraft,
    useWorkflow,
    withAssets,
    onOk,
    onClose,
    /* eslint-enable prefer-const */
  } = $props();

  const collection = $derived(entryDraft.current?.collection);
  const collectionFile = $derived(entryDraft.current?.collectionFile);
  const originalEntry = $derived(entryDraft.current?.originalEntry);
  // What the deletion means for the entries referencing this one through Relation fields. Nothing
  // on the configured branch can reference a draft that has never been published, and the scan is
  // only worth doing while the dialog is open
  const cascadePlan = $derived(
    open && collection && originalEntry && !discardsDraft
      ? planCascadeDelete({ collection, collectionFile, entries: [originalEntry] })
      : EMPTY_CASCADE_DELETE_PLAN,
  );
</script>

<ConfirmationDialog
  bind:open
  title={_('delete_entries', { values: { count: 1 } })}
  okLabel={_('delete')}
  okDisabled={!!cascadePlan.blockers.length}
  {onOk}
  {onClose}
>
  <!-- There’s nothing to confirm when the deletion is refused; the note explains why -->
  {#if cascadePlan.blockers.length}
    <CascadeDeleteNote plan={cascadePlan} count={1} />
  {:else}
    {#if discardsDraft}
      {_('workflow.confirm_deleting_unpublished_entry')}
    {:else if useWorkflow}
      <!-- The removal is committed to a pull request rather than to the configured branch -->
      {_('workflow.confirm_deleting_published_entry')}
    {:else}
      {_(withAssets ? 'confirm_deleting_this_entry_with_assets' : 'confirm_deleting_this_entry')}
    {/if}
    <CascadeDeleteNote plan={cascadePlan} count={1} />
  {/if}
</ConfirmationDialog>
