<!--
  @component
  Control that opens the pull request of an unpublished entry on the Git service, shown in place of
  the Publish control for a pull request a contributor has opened from their fork. Such a pull
  request is reviewed and merged there, where everything on the contributor’s branch can be seen.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Button, Icon } from '@sveltia/ui';

  import { backend } from '$lib/services/backends';
  import { openNewTab } from '$lib/services/utils/window';

  /**
   * @import { UnpublishedEntry } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {UnpublishedEntry} entry Unpublished entry.
   * @property {'small' | 'medium'} [size] Button size.
   * @property {boolean} [iconic] Whether to show the icon only, with the label as the accessible
   * name.
   * @property {boolean} [disabled] Whether to disable the control.
   */

  /** @type {Props} */
  let { entry, size = 'medium', iconic = false, disabled = false } = $props();

  const label = $derived(
    _('workflow.review_on_x', { values: { service: backend.current?.repository?.label ?? '' } }),
  );
</script>

<Button
  variant={iconic ? 'ghost' : 'primary'}
  {size}
  {iconic}
  {disabled}
  label={iconic ? undefined : label}
  aria-label={iconic ? label : undefined}
  onclick={() => {
    openNewTab(entry.workflow.pullRequest.url);
  }}
>
  {#snippet endIcon()}
    <!-- The card’s preview link already has the new tab icon, so the iconic control has its own -->
    <Icon name={iconic ? 'rate_review' : 'open_in_new'} />
  {/snippet}
</Button>
