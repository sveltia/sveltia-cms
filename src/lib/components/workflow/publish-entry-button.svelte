<!--
  @component
  Editor toolbar button to publish the entry being edited, shown once it’s ready to be published.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Alert, Button, ConfirmationDialog, Toast } from '@sveltia/ui';

  import { getCollection } from '$lib/services/contents/collection';
  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import { isPublishAllowed, publishingBranches } from '$lib/services/workflow';
  import { getPublishDialogStrings } from '$lib/services/workflow/dialogs';
  import { closeWorkflowEntryEditor } from '$lib/services/workflow/editor';
  import { publishWorkflowEntry } from '$lib/services/workflow/save';
  import { canPublish } from '$lib/services/workflow/validate';
  import { getWorkflowErrorMessage } from '$lib/services/workflow/verify';

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
  /** Message the error toast shows, which says why publishing has failed if it can. */
  let errorMessage = $state('');
  let showValidationToast = $state(false);

  // Publishing a removal is what deletes the entry, so the control is presented as Delete
  const deletion = $derived(entry.workflow.status === 'pending_deletion');
  const dialogStrings = $derived(getPublishDialogStrings({ deletion }));
  // The service records the merge in flight, rather than this component: a merge can take minutes
  // and outlive the editor, and the control stays disabled when the entry is reopened meanwhile
  const publishing = $derived(
    publishingBranches.current.includes(entry.workflow.pullRequest.branch),
  );
  // Only a user who can merge the pull request gets the control, once the entry is ready
  const visible = $derived(isPublishAllowed(entry, getCollection(entry.workflow.collectionName)));

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
      closeWorkflowEntryEditor({ entryDraft, branch: pullRequest.branch, collectionName });
    } catch (/** @type {any} */ ex) {
      errorMessage = getWorkflowErrorMessage(ex, 'workflow.publishing_entry_failed');
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
  <Alert status="error">{errorMessage}</Alert>
</Toast>

<Toast bind:show={showValidationToast}>
  <Alert status="error">{_('workflow.publish_blocked')}</Alert>
</Toast>
