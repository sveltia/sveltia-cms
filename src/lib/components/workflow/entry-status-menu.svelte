<!--
  @component
  Editor toolbar menu button to change the Editorial Workflow status of the entry being edited.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Alert, Menu, MenuButton, MenuItemRadio, Toast } from '@sveltia/ui';

  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import { env } from '$lib/services/user/env.svelte';
  import { WORKFLOW_STATUS_LABELS } from '$lib/services/workflow/constants';
  import { handleEntryAlreadyPublished } from '$lib/services/workflow/editor';
  import { workflowStages } from '$lib/services/workflow/open-authoring';
  import { updateWorkflowStatus } from '$lib/services/workflow/save';
  import { canMoveToStatus } from '$lib/services/workflow/validate';
  import { getWorkflowErrorMessage } from '$lib/services/workflow/verify';

  /**
   * @import { UnpublishedEntry, WorkflowStatus } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {UnpublishedEntry} entry Unpublished entry being edited.
   * @property {boolean} [disabled] Whether to disable the control.
   */

  const entryDraft = getEntryDraftContext();

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    entry,
    disabled = false,
    /* eslint-enable prefer-const */
  } = $props();

  let updating = $state(false);
  let showErrorToast = $state(false);
  let errorMessage = $state('');
  let showValidationToast = $state(false);

  const status = $derived(entry.workflow.status);
  const statusName = $derived(_(WORKFLOW_STATUS_LABELS[status]));
  // The status name alone doesn’t say what it refers to, so spell it out where there’s room. A
  // small screen only gets the name, but the accessible name keeps the prefix for context
  const qualifiedStatusName = $derived(
    _('workflow.entry_status_value', { values: { status: statusName } }),
  );

  /**
   * Change the entry’s status, which updates the label and draft state on the pull request.
   * @param {WorkflowStatus} newStatus New status.
   */
  const changeStatus = async (newStatus) => {
    if (newStatus === status || updating) {
      return;
    }

    // An entry can be saved as a draft with its required fields left empty, so it has to be checked
    // before it moves towards being published
    if (!canMoveToStatus({ entry, status: newStatus, draft: entryDraft.current })) {
      showValidationToast = true;

      return;
    }

    updating = true;

    // Read these up front: an entry that turns out to have been published leaves
    // `unpublishedEntries`, and the `entry` prop is derived from that store
    const { collectionName, pullRequest } = entry.workflow;

    try {
      await updateWorkflowStatus(entry, newStatus);
    } catch (/** @type {any} */ ex) {
      // An entry published since it was opened closes the editor instead
      if (
        !handleEntryAlreadyPublished(ex, { entryDraft, branch: pullRequest.branch, collectionName })
      ) {
        errorMessage = getWorkflowErrorMessage(ex, 'workflow.status_change_failed');
        showErrorToast = true;
        // eslint-disable-next-line no-console
        console.error(ex);
      }
    } finally {
      updating = false;
    }
  };
</script>

<MenuButton
  variant="ghost"
  label={updating
    ? _('workflow.changing_status')
    : env.isLargeScreen
      ? qualifiedStatusName
      : statusName}
  disabled={disabled || updating}
  popupPosition="bottom-right"
  aria-label={updating ? _('workflow.changing_status') : qualifiedStatusName}
>
  {#snippet popup()}
    <Menu ariaLabel={_('workflow.change_entry_status')}>
      {#each workflowStages.current as _status (_status)}
        <MenuItemRadio
          label={_(WORKFLOW_STATUS_LABELS[_status])}
          checked={_status === status}
          onChange={() => {
            changeStatus(_status);
          }}
        />
      {/each}
    </Menu>
  {/snippet}
</MenuButton>

<Toast bind:show={showErrorToast}>
  <Alert status="error">{errorMessage}</Alert>
</Toast>

<Toast bind:show={showValidationToast}>
  <Alert status="error">{_('workflow.status_change_blocked')}</Alert>
</Toast>
