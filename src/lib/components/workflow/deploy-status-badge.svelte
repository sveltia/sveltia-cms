<!--
  @component
  Pill showing the state of the deploy preview built for an unpublished entry, used alongside the
  Editorial Workflow status in the entry list and on the workflow board.
-->
<script>
  import { _ } from '@sveltia/i18n';

  import StatusPill from '$lib/components/common/status-pill.svelte';
  import { DEPLOY_STATE_MESSAGES } from '$lib/services/deployments/constants';

  /**
   * @import { DeployState, StatusPillTone } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {DeployState} state Deploy state to be shown.
   */

  /** @type {Props} */
  let { state } = $props();

  /**
   * Labels and pill color tones for the states worth showing. A finished build needs no badge,
   * because the preview link itself says the preview is available, and an unknown state has
   * nothing to report. Neither does a lookup in flight, which is over in moments — a pill that
   * flashed up on every card as the board opened would be noise rather than information. Each
   * pill gets the full message as its tooltip, the same one the entry editor gives its preview
   * button. For a failed build, that tells the editor the failure isn’t necessarily theirs and who
   * to ask, as the pill alone leaves them guessing.
   * @type {Record<string, { label: string, tone: StatusPillTone }>}
   */
  const BADGES = {
    pending: { label: 'deploy_preview.short.building', tone: 'warning' },
    error: { label: 'deploy_preview.short.failed', tone: 'error' },
  };

  const badge = $derived(BADGES[state]);
</script>

{#if badge}
  <StatusPill
    tone={badge.tone}
    label={_(badge.label)}
    title={_(/** @type {string} */ (DEPLOY_STATE_MESSAGES[state]))}
    class="deploy-status-badge {state}"
  />
{/if}
