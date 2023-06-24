<script>
  import { Icon, Menu, MenuButton, MenuItemRadio } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { writable } from 'svelte/store';

  export let label = '';
  export let disabled = false;
  /**
   * @type {import('svelte/store').Writable<EntryListView | AssetListView>}
   */
  export let currentView = writable({});
  export let noneLabel = '';
  /**
   * @type {ViewFilter[]}
   */
  export let filters = [];
</script>

<MenuButton class="ghost" label={label || $_('filter_by')} {disabled}>
  <Icon slot="end-icon" name="arrow_drop_down" />
  <Menu slot="popup">
    <MenuItemRadio
      label={noneLabel || $_('sort_keys.none')}
      checked={!$currentView.filter}
      on:click={() => {
        currentView.update((view) => ({
          ...view,
          filter: undefined,
        }));
      }}
    />
    {#each filters as { label: _label, field, pattern }}
      <MenuItemRadio
        label={_label}
        checked={$currentView.filter?.field === field && $currentView.filter?.pattern === pattern}
        on:click={() => {
          currentView.update((view) => ({
            ...view,
            filter: { field, pattern },
          }));
        }}
      />
    {/each}
  </Menu>
</MenuButton>
