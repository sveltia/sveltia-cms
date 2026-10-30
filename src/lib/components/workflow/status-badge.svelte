<!--
  @component
  Pill showing the Editorial Workflow status of an unpublished entry, used in the entry and file
  lists.
-->
<script>
  import { _ } from '@sveltia/i18n';

  import StatusPill from '$lib/components/common/status-pill.svelte';
  import { WORKFLOW_STATUS_LABELS } from '$lib/services/workflow/constants';

  /**
   * @import { StatusPillTone, WorkflowStatus } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {WorkflowStatus} status Workflow status to be shown.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    status,
    /* eslint-enable prefer-const */
  } = $props();

  /**
   * Pill color tone for each status.
   * @type {Record<WorkflowStatus, StatusPillTone>}
   */
  const TONES = {
    draft: 'info',
    pending_review: 'warning',
    pending_publish: 'success',
    pending_deletion: 'error',
  };
</script>

<StatusPill
  tone={TONES[status]}
  label={_(WORKFLOW_STATUS_LABELS[status])}
  class="status-badge {status}"
/>
