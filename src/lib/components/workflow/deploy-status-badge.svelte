<!--
  @component
  Pill showing the state of the deploy preview built for an unpublished entry, used alongside the
  Editorial Workflow status in the entry list and on the workflow board.
-->
<script>
  import { _ } from '@sveltia/i18n';

  /**
   * @import { DeployState } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {DeployState} state Deploy state to be shown.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    state,
    /* eslint-enable prefer-const */
  } = $props();

  /**
   * Labels for the states worth showing. A finished build needs no badge, because the preview link
   * itself says the preview is available, and an unknown state has nothing to report. Neither does
   * a lookup in flight, which is over in moments — a pill that flashed up on every card as the
   * board opened would be noise rather than information.
   * @type {Record<string, string>}
   */
  const LABELS = {
    pending: 'deploy_preview.short.building',
    error: 'deploy_preview.short.failed',
  };

  const label = $derived(LABELS[state]);
</script>

{#if label}
  <span role="none" class="deploy-status-badge {state}">
    {_(label)}
  </span>
{/if}

<style>
  /*
   * Filled pill following the same background/foreground/border recipe as the Alert and Infobar
   * components, so the colors adapt to both the light and dark themes. The border does most of the
   * work in dark mode, where the alert background is nearly the same as the row background.
   */

  .deploy-status-badge {
    display: inline-block;
    border-width: 1px;
    border-style: solid;
    border-radius: 12px;
    padding: 1px 6px;
    font-size: var(--sui-font-size-x-small);
    line-height: var(--sui-line-height-compact);
    white-space: nowrap;

    &.pending {
      border-color: var(--sui-warning-border-color);
      background-color: var(--sui-warning-background-color);
      color: var(--sui-warning-foreground-color);
    }

    &.error {
      border-color: var(--sui-error-border-color);
      background-color: var(--sui-error-background-color);
      color: var(--sui-error-foreground-color);
    }
  }
</style>
