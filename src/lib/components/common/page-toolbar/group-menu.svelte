<script>
  import { Icon, Menu, MenuButton, MenuItemRadio } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';

  export let label = '';
  export let disabled = false;
  /**
   * @type {import('svelte/store').Writable<EntryListView | AssetListView>}
   */
  export let currentView;
  export let noneLabel = '';
  /**
   * @type {ViewFilter[]}
   */
  export let groups = [];
</script>

<MenuButton variant="ghost" label={label || $_('group')} {disabled}>
  <Icon slot="end-icon" name="arrow_drop_down" />
  <Menu
    slot="popup"
    aria-label={$_('grouping_options')}
    aria-controls={$$restProps['aria-controls']}
  >
    <MenuItemRadio
      label={noneLabel || $_('sort_keys.none')}
      checked={!$currentView.group}
      on:select={() => {
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
        on:select={() => {
          currentView.update((view) => ({
            ...view,
            group: { field, pattern },
          }));
        }}
      />
    {/each}
  </Menu>
</MenuButton>
