<!--
  @component
  Render the menu items that revert the changes, restore the default values and clear the fields,
  preceded by a separator. The field options menu, the content options menu of an editor pane and
  the editor options menu all list them.
-->
<script>
  import { Divider, MenuItem } from '@sveltia/ui';

  import { getResetLabel, RESET_ACTIONS } from '$lib/services/contents/editor/reset';

  /**
   * @import { ResetAction, ResetScope } from '$lib/services/contents/editor/reset';
   */

  /**
   * @typedef {object} Props
   * @property {ResetScope} scope What the actions apply to.
   * @property {Partial<Record<ResetAction, boolean>>} available Whether each action would change
   * anything, keyed by action. An action missing from it isn’t offered.
   * @property {boolean} [separator] Whether to show a separator above the items, which is left out
   * when nothing comes before them.
   * @property {(action: ResetAction) => void} onSelect Function called with the chosen action.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    scope,
    available,
    separator = true,
    onSelect,
    /* eslint-enable prefer-const */
  } = $props();
</script>

{#if separator}
  <Divider />
{/if}
{#each RESET_ACTIONS.filter((action) => action in available) as action (action)}
  <MenuItem
    label={getResetLabel(action, scope)}
    disabled={!available[action]}
    onclick={() => {
      onSelect(action);
    }}
  />
{/each}
