<script>
  import { Menu, MenuButton, MenuItemRadio } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';

  /**
   * @import { Writable } from 'svelte/store';
   * @import { AssetListView, EntryListView } from '$lib/types/private';
   * @import { ViewGroup } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {Writable<EntryListView | AssetListView>} currentView Current view details.
   * @property {string} aria-controls The `aria-controls` attribute for the menu.
   * @property {string} [label] Menu button label.
   * @property {boolean} [disabled] Whether to disable the button.
   * @property {string} [noneLabel] Label to be displayed on the None item.
   * @property {ViewGroup[]} [groups] Group conditions.
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
    /* eslint-enable prefer-const */
  } = $props();
</script>

<MenuButton variant="ghost" label={label || $_('group')} {disabled} popupPosition="bottom-right">
  {#snippet popup()}
    <Menu aria-label={$_('grouping_options')} aria-controls={ariaControls}>
      <MenuItemRadio
        label={noneLabel || $_('sort_keys.none')}
        checked={!$currentView.group}
        onSelect={() => {
          currentView.update((view) => ({
            ...view,
            group: null,
          }));
        }}
      />
      {#each groups as group (JSON.stringify(group))}
        {@const { label: _label, field, pattern } = group}
        <MenuItemRadio
          label={_label}
          checked={$currentView.group?.field === field &&
            String($currentView.group.pattern) === String(pattern)}
          onSelect={() => {
            currentView.update((view) => ({
              ...view,
              group: { field, pattern },
            }));
          }}
        />
      {/each}
    </Menu>
  {/snippet}
</MenuButton>
