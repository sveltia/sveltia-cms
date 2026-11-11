<script>
  import { _ } from '@sveltia/i18n';
  import { Divider, Menu, MenuButton, MenuItem } from '@sveltia/ui';

  import ConditionRadioItems from '$lib/components/common/page-toolbar/condition-radio-items.svelte';
  import {
    getCollapsibleGroupNames,
    isCollapsedByDefault,
    isGroupCollapsed,
    setAllGroupsCollapsed,
  } from '$lib/services/common/view';

  /**
   * @import { AssetListView, EntryListView } from '$lib/types/private';
   * @import { ViewGroup } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {{ current: EntryListView | AssetListView }} currentView Current view details.
   * @property {string} aria-controls The `aria-controls` attribute for the menu.
   * @property {string} [label] Menu button label.
   * @property {boolean} [disabled] Whether to disable the button.
   * @property {string} [noneLabel] Label to be displayed on the None item.
   * @property {ViewGroup[]} [groups] Group conditions.
   * @property {string[]} [groupNames] Names of the groups currently in the list, which the Expand
   * All and Collapse All items act on.
   */

  /** @type {Props} */
  let {
    currentView,
    'aria-controls': ariaControls,
    label = '',
    disabled = false,
    noneLabel = '',
    groups = [],
    groupNames = [],
  } = $props();

  const collapsibleGroupNames = $derived(getCollapsibleGroupNames(groupNames));
  const collapsedByDefault = $derived(isCollapsedByDefault(groups, currentView.current.group));
  const canExpandAll = $derived(
    collapsibleGroupNames.some((name) =>
      isGroupCollapsed(currentView.current, name, collapsedByDefault),
    ),
  );
  const canCollapseAll = $derived(
    collapsibleGroupNames.some(
      (name) => !isGroupCollapsed(currentView.current, name, collapsedByDefault),
    ),
  );
</script>

<MenuButton variant="ghost" label={label || _('group')} {disabled} popupPosition="bottom-right">
  {#snippet popup()}
    <Menu ariaLabel={_('grouping_options')} aria-controls={ariaControls}>
      <ConditionRadioItems
        {currentView}
        viewKey="group"
        noneValue={null}
        {noneLabel}
        options={groups}
      />
      <Divider />
      <MenuItem
        label={_('expand_all')}
        disabled={!canExpandAll}
        onclick={() => {
          currentView.current = setAllGroupsCollapsed(
            currentView.current,
            collapsibleGroupNames,
            false,
            collapsedByDefault,
          );
        }}
      />
      <MenuItem
        label={_('collapse_all')}
        disabled={!canCollapseAll}
        onclick={() => {
          currentView.current = setAllGroupsCollapsed(
            currentView.current,
            collapsibleGroupNames,
            true,
            collapsedByDefault,
          );
        }}
      />
    </Menu>
  {/snippet}
</MenuButton>
