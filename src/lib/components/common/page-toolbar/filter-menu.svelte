<script>
  import { Icon, Menu, MenuButton, MenuItemRadio } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';

  export let label = '';
  export let disabled = false;
  export let currentView = {};
  export let noneLabel = '';
  export let filters = [];
</script>

<MenuButton class="ternary" label={label || $_('filter_by')} {disabled}>
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
    {#each filters as { label, field, pattern }}
      <MenuItemRadio
        {label}
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
