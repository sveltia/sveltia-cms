<!--
  @component
  Editor toolbar button to publish the entry being edited, shown once it’s ready to be published.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Alert, Button, ConfirmationDialog, Toast } from '@sveltia/ui';

  import { goBack } from '$lib/services/app/navigation';
  import { getCollection } from '$lib/services/contents/collection';
  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import { publishingBranches } from '$lib/services/workflow';
  import { getPublishDialogStrings } from '$lib/services/workflow/dialogs';
  import { openAuthoring } from '$lib/services/workflow/open-authoring';
  import { publishWorkflowEntry } from '$lib/services/workflow/save';
  import { canPublish } from '$lib/services/workflow/validate';

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

  const entryDraft = getEntryDraftContext();

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    entry,
    disabled = false,
    modified = false,
    /* eslint-enable prefer-const */
  } = $props();

  let showPublishDialog = $state(false);
  let showErrorToast = $state(false);
  let showValidationToast = $state(false);

  // Publishing a removal is what deletes the entry, so the control is presented as Delete
  const deletion = $derived(entry.workflow.status === 'pending_deletion');
  const dialogStrings = $derived(getPublishDialogStrings({ deletion }));
  // The service records the merge in flight, rather than this component: a merge can take minutes
  // and outlive the editor, and the control stays disabled when the entry is reopened meanwhile
  const publishing = $derived(
    publishingBranches.current.includes(entry.workflow.pullRequest.branch),
  );
  // The collection’s `publish` option can hide the control, so an editor can move an entry through
  // the review stages but leave the actual publishing to someone else. An Open Authoring
  // contributor can’t merge a pull request on the configured repository, so they never see it
  const visible = $derived(
    !openAuthoring.current &&
      (entry.workflow.status === 'pending_publish' || deletion) &&
      getCollection(entry.workflow.collectionName)?.publish !== false,
  );

  /**
   * Publish the entry by merging the pull request, then go back to the entry list.
   */
  const publish = async () => {
    // An entry can be saved as a draft with its required fields left empty, so it’s checked first
    if (!canPublish({ entry, draft: entryDraft.current })) {
      showValidationToast = true;

      return;
    }

    // Read these up front: publishing takes the entry out of `unpublishedEntries`, and the `entry`
    // prop is derived from that store, so it’s `undefined` once the merge resolves
    const { collectionName, pullRequest } = entry.workflow;

    try {
      await publishWorkflowEntry(entry);

      // The merge can take minutes when the Git service waits for a pipeline, and the editor can
      // have moved on by then: the draft state is shared by the whole page, so the draft open now
      // may be another entry’s, with unsaved changes. Only this entry’s draft is closed
      const originalEntry = /** @type {UnpublishedEntry | undefined} */ (
        entryDraft.current?.originalEntry
      );

      if (originalEntry?.workflow?.pullRequest.branch === pullRequest.branch) {
        entryDraft.current = null;
        goBack(`/collections/${collectionName}`);
      }
    } catch (/** @type {any} */ ex) {
      showErrorToast = true;
      // eslint-disable-next-line no-console
      console.error(ex);
    }
  };
</script>

{#if visible}
  <Button
    variant="primary"
    label={publishing && !deletion ? _('publishing') : dialogStrings.label}
    aria-label={dialogStrings.title}
    disabled={disabled || (modified && !deletion) || publishing}
    onclick={() => {
      showPublishDialog = true;
    }}
  />
{/if}

<ConfirmationDialog
  bind:open={showPublishDialog}
  title={dialogStrings.title}
  okLabel={dialogStrings.label}
  onOk={() => {
    publish();
  }}
>
  {dialogStrings.message}
</ConfirmationDialog>

<Toast bind:show={showErrorToast}>
  <Alert status="error">{_('workflow.publishing_entry_failed')}</Alert>
</Toast>

<Toast bind:show={showValidationToast}>
  <Alert status="error">{_('workflow.publish_blocked')}</Alert>
</Toast>
