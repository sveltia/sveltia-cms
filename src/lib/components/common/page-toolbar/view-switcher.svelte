<script>
  import { SelectButton, SelectButtonGroup } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { writable } from 'svelte/store';

  export let disabled = false;
  export let currentView = writable({});
</script>

<SelectButtonGroup {disabled} ariaLabel={$_('switch_view')}>
  <SelectButton
    {disabled}
    selected={$currentView.type !== 'grid'}
    class="secondary iconic"
    iconName="format_list_bulleted"
    iconLabel={$_('list_view')}
    on:click={() => {
      currentView.update((view) => ({
        ...view,
        type: 'list',
      }));
    }}
  />
  <SelectButton
    {disabled}
    selected={$currentView.type === 'grid'}
    class="secondary iconic"
    iconName="grid_view"
    iconLabel={$_('grid_view')}
    on:click={() => {
      currentView.update((view) => ({
        ...view,
        type: 'grid',
      }));
    }}
  />
</SelectButtonGroup>
