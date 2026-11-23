<!--
  @component
  Editor toolbar menu button to change the Editorial Workflow status of the entry being edited. With
  Preview Workflow, there’s only the drafting stage to be in, so the status is shown as a badge.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Alert, Menu, MenuButton, MenuItemRadio, Toast } from '@sveltia/ui';

  import StatusBadge from '$lib/components/workflow/status-badge.svelte';
  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import { env } from '$lib/services/user/env.svelte';
  import { WORKFLOW_STATUS_LABELS } from '$lib/services/workflow/constants';
  import { runWorkflowEditorAction } from '$lib/services/workflow/editor';
  import { updateWorkflowStatus } from '$lib/services/workflow/save';
  import { getStageOfEntry, getStagesOfEntry } from '$lib/services/workflow/stages';
  import { canMoveToStatus } from '$lib/services/workflow/validate';

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
  let { entry, disabled = false } = $props();

  let updating = $state(false);
  let showErrorToast = $state(false);
  let errorMessage = $state('');
  let showValidationToast = $state(false);
  /**
   * Incremented when a status change fails or is blocked, to render the menu items again: a menu
   * item checks itself once clicked, and would otherwise stay checked, so the stage couldn’t be
   * picked again to retry.
   */
  let itemsVersion = $state(0);

  // The stages the collection is configured with, and the one the entry is in. A pull request whose
  // label isn’t among the stages is shown in the nearest earlier one
  const stages = $derived(getStagesOfEntry(entry));
  const status = $derived(getStageOfEntry(entry));
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

    const { blocked, errorMessage: message } = await runWorkflowEditorAction({
      entry,
      entryDraft,
      valid: canMoveToStatus({ entry, status: newStatus, draft: entryDraft.current }),
      /**
       * Change the status, flagging the change as under way.
       * @returns {Promise<UnpublishedEntry>} Updated entry.
       */
      action: () => {
        updating = true;

        return updateWorkflowStatus(entry, newStatus);
      },
      failure: 'workflow.status_change_failed',
      handleAlreadyPublished: true,
    });

    updating = false;

    if (blocked) {
      showValidationToast = true;
    } else if (message) {
      errorMessage = message;
      showErrorToast = true;
    } else {
      return;
    }

    itemsVersion += 1;
  };
</script>

{#if stages.length === 1}
  <StatusBadge {status} />
{:else}
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
        {#key itemsVersion}
          {#each stages as _status (_status)}
            <MenuItemRadio
              label={_(WORKFLOW_STATUS_LABELS[_status])}
              checked={_status === status}
              onChange={() => {
                changeStatus(_status);
              }}
            />
          {/each}
        {/key}
      </Menu>
    {/snippet}
  </MenuButton>
{/if}

<Toast bind:show={showErrorToast}>
  <Alert status="error">{errorMessage}</Alert>
</Toast>

<Toast bind:show={showValidationToast}>
  <Alert status="error">{_('workflow.status_change_blocked')}</Alert>
</Toast>
