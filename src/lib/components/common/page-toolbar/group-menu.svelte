<script>
  import { Menu, MenuButton, MenuItemRadio } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';

  /**
   * @typedef {object} Props
   * @property {import('svelte/store').Writable<EntryListView | AssetListView>} currentView -
   * Current view details.
   * @property {string} aria-controls - The `aria-controls` attribute for the menu.
   * @property {string} [label] - Menu button label.
   * @property {boolean} [disabled] - Whether to disable the button.
   * @property {string} [noneLabel] - Label to be displayed on the None item.
   * @property {ViewFilter[]} [groups] - Group conditions.
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
            group: undefined,
          }));
        }}
      />
      {#each groups as { label: _label, field, pattern }}
        <MenuItemRadio
          label={_label}
          checked={$currentView.group?.field === field && $currentView.group?.pattern === pattern}
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
