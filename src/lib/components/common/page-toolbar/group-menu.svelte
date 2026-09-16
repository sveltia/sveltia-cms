<script>
  import { _ } from '@sveltia/i18n';
  import { Divider, Menu, MenuButton, MenuItem, MenuItemRadio } from '@sveltia/ui';

  import {
    getCollapsibleGroupNames,
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
    /* eslint-disable prefer-const */
    currentView,
    'aria-controls': ariaControls,
    label = '',
    disabled = false,
    noneLabel = '',
    groups = [],
    groupNames = [],
    /* eslint-enable prefer-const */
  } = $props();

  const collapsibleGroupNames = $derived(getCollapsibleGroupNames(groupNames));
  const canExpandAll = $derived(
    collapsibleGroupNames.some((name) => isGroupCollapsed(currentView.current, name)),
  );
  const canCollapseAll = $derived(
    collapsibleGroupNames.some((name) => !isGroupCollapsed(currentView.current, name)),
  );
</script>

<MenuButton variant="ghost" label={label || _('group')} {disabled} popupPosition="bottom-right">
  {#snippet popup()}
    <Menu ariaLabel={_('grouping_options')} aria-controls={ariaControls}>
      <MenuItemRadio
        label={noneLabel || _('sort_keys.none')}
        checked={!currentView.current.group}
        onSelect={() => {
          currentView.current = {
            ...currentView.current,
            group: null,
          };
        }}
      />
      {#each groups as group (`${group.field}|${String(group.pattern)}`)}
        {@const { label: _label, field, pattern } = group}
        <MenuItemRadio
          label={_label}
          checked={currentView.current.group?.field === field &&
            String(currentView.current.group.pattern) === String(pattern)}
          onSelect={() => {
            currentView.current = {
              ...currentView.current,
              group: { field, pattern },
            };
          }}
        />
      {/each}
      <Divider />
      <MenuItem
        label={_('expand_all')}
        disabled={!canExpandAll}
        onclick={() => {
          currentView.current = setAllGroupsCollapsed(
            currentView.current,
            collapsibleGroupNames,
            false,
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
          );
        }}
      />
    </Menu>
  {/snippet}
</MenuButton>
