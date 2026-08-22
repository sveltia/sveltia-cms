<!--
  @component
  Editor toolbar button to publish the entry being edited, shown once it’s ready to be published.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Alert, Button, ConfirmationDialog, Toast } from '@sveltia/ui';

  import { goBack } from '$lib/services/app/navigation';
  import { getCollection } from '$lib/services/contents/collection';
  import { entryDraft } from '$lib/services/contents/draft';
  import { openAuthoring } from '$lib/services/workflow/open-authoring';
  import { publishWorkflowEntry } from '$lib/services/workflow/save';

  /**
   * @import { UnpublishedEntry } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {UnpublishedEntry} entry Unpublished entry being edited.
   * @property {boolean} [disabled] Whether to disable the control.
   * @property {boolean} [modified] Whether the draft has unsaved changes. Publishing would merge
   * the pull request as it stands and throw those changes away, so the control is disabled until
   * they’re saved. It doesn’t apply to a removal, which has no content to publish.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    entry,
    disabled = false,
    modified = false,
    /* eslint-enable prefer-const */
  } = $props();

  let publishing = $state(false);
  let showPublishDialog = $state(false);
  let showErrorToast = $state(false);

  // Publishing a removal is what deletes the entry, so the control is presented as Delete
  const deletion = $derived(entry.workflow.status === 'pending_deletion');
  // The collection’s `publish` option can hide the control, so an editor can move an entry through
  // the review stages but leave the actual publishing to someone else. An Open Authoring
  // contributor can’t merge a pull request on the configured repository, so they never see it
  const visible = $derived(
    !$openAuthoring &&
      (entry.workflow.status === 'pending_publish' || deletion) &&
      getCollection(entry.workflow.collectionName)?.publish !== false,
  );

  /**
   * Publish the entry by merging the pull request, then go back to the entry list.
   */
  const publish = async () => {
    // Read the collection name up front: publishing takes the entry out of `unpublishedEntries`,
    // and the `entry` prop is derived from that store, so it’s `undefined` once the merge resolves
    const { collectionName } = entry.workflow;

    publishing = true;

    try {
      await publishWorkflowEntry(entry);
      $entryDraft = null;
      goBack(`/collections/${collectionName}`);
    } catch (/** @type {any} */ ex) {
      showErrorToast = true;
      // eslint-disable-next-line no-console
      console.error(ex);
    } finally {
      publishing = false;
    }
  };
</script>

{#if visible}
  <Button
    variant="primary"
    label={_(deletion ? 'delete' : publishing ? 'publishing' : 'publish')}
    aria-label={deletion
      ? _('delete_entries', { values: { count: 1 } })
      : _('workflow.publish_entry')}
    disabled={disabled || (modified && !deletion) || publishing}
    onclick={() => {
      showPublishDialog = true;
    }}
  />
{/if}

<ConfirmationDialog
  bind:open={showPublishDialog}
  title={deletion ? _('delete_entries', { values: { count: 1 } }) : _('workflow.publish_entry')}
  okLabel={_(deletion ? 'delete' : 'publish')}
  onOk={() => {
    publish();
  }}
>
  {_(deletion ? 'workflow.confirm_completing_deletion' : 'workflow.confirm_publishing_entry')}
</ConfirmationDialog>

<Toast bind:show={showErrorToast}>
  <Alert status="error">{_('workflow.publishing_entry_failed')}</Alert>
</Toast>
