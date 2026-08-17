<!--
  @component
  Pill showing the Editorial Workflow status of an unpublished entry, used in the entry and file
  lists.
-->
<script>
  import { _ } from '@sveltia/i18n';

  import { WORKFLOW_STATUS_LABELS } from '$lib/services/workflow/constants';

  /**
   * @import { WorkflowStatus } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {WorkflowStatus} status Workflow status to be shown.
   * @property {boolean} [deletion] Whether the pull request removes the entry from the site rather
   * than updating it. Its status is always `pending_publish`, which on its own reads as though the
   * entry’s content were ready to go live.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    status,
    deletion = false,
    /* eslint-enable prefer-const */
  } = $props();
</script>

<span role="none" class="status-badge {deletion ? 'deletion' : status}">
  {_(deletion ? 'workflow.pending_deletion' : WORKFLOW_STATUS_LABELS[status])}
</span>

<style>
  /*
   * Filled pill following the same background/foreground/border recipe as the Alert and Infobar
   * components, so the colors adapt to both the light and dark themes. The border does most of the
   * work in dark mode, where the alert background is nearly the same as the row background.
   */

  .status-badge {
    display: inline-block;
    border-width: 1px;
    border-style: solid;
    border-radius: 12px;
    padding: 1px 6px;
    font-size: var(--sui-font-size-x-small);
    line-height: var(--sui-line-height-compact);
    white-space: nowrap;

    &.draft {
      border-color: var(--sui-info-border-color);
      background-color: var(--sui-info-background-color);
      color: var(--sui-info-foreground-color);
    }

    &.pending_review {
      border-color: var(--sui-warning-border-color);
      background-color: var(--sui-warning-background-color);
      color: var(--sui-warning-foreground-color);
    }

    &.pending_publish {
      border-color: var(--sui-success-border-color);
      background-color: var(--sui-success-background-color);
      color: var(--sui-success-foreground-color);
    }

    &.deletion {
      border-color: var(--sui-error-border-color);
      background-color: var(--sui-error-background-color);
      color: var(--sui-error-foreground-color);
    }
  }
</style>
