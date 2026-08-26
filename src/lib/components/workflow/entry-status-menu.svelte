<!--
  @component
  Editor toolbar menu button to change the Editorial Workflow status of the entry being edited.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Alert, Menu, MenuButton, MenuItemRadio, Toast } from '@sveltia/ui';

  import { env } from '$lib/services/user/env.svelte';
  import { WORKFLOW_STATUS_LABELS } from '$lib/services/workflow/constants';
  import { workflowStages } from '$lib/services/workflow/open-authoring';
  import { updateWorkflowStatus } from '$lib/services/workflow/save';

  /**
   * @import { UnpublishedEntry, WorkflowStatus } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {UnpublishedEntry} entry Unpublished entry being edited.
   * @property {boolean} [disabled] Whether to disable the control.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    entry,
    disabled = false,
    /* eslint-enable prefer-const */
  } = $props();

  let updating = $state(false);
  let showErrorToast = $state(false);

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

    updating = true;

    try {
      await updateWorkflowStatus(entry, newStatus);
    } catch (/** @type {any} */ ex) {
      showErrorToast = true;
      // eslint-disable-next-line no-console
      console.error(ex);
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
    <Menu aria-label={_('workflow.change_entry_status')}>
      {#each $workflowStages as _status (_status)}
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
  <Alert status="error">{_('workflow.status_change_failed')}</Alert>
</Toast>
