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
  import { runWorkflowEditorAction } from '$lib/services/workflow/editor';
  import { publishReviewedEntry } from '$lib/services/workflow/save';
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
  let { entry, disabled = false, modified = false } = $props();

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
    const { blocked, errorMessage: message } = await runWorkflowEditorAction({
      entry,
      entryDraft,
      valid: canPublish({ entry, draft: entryDraft.current }),
      /**
       * Merge the pull request, pinned to the version the editor shows.
       * @returns {Promise<void>} Result.
       */
      action: () => publishReviewedEntry(entry, entryDraft.current?.originalEntry),
      failure: 'workflow.publishing_entry_failed',
      closeOnSuccess: true,
    });

    if (blocked) {
      showValidationToast = true;
    } else if (message) {
      errorMessage = message;
      showErrorToast = true;
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
