<script>
  import { Icon, Menu, MenuButton, MenuItemRadio } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { writable } from 'svelte/store';

  export let label = '';
  export let disabled = false;
  /** @type {import('svelte/store').Writable<EntryView>} */
  export let currentView = writable({});
  export let noneLabel = '';
  export let groups = [];
</script>

<MenuButton class="ghost" label={label || $_('group_by')} {disabled}>
  <Icon slot="end-icon" name="arrow_drop_down" />
  <Menu slot="popup">
    <MenuItemRadio
      label={noneLabel || $_('sort_keys.none')}
      checked={!$currentView.group}
      on:click={() => {
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
        on:click={() => {
          currentView.update((view) => ({
            ...view,
            group: { field, pattern },
          }));
        }}
      />
    {/each}
  </Menu>
</MenuButton>
