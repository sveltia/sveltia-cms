<script>
  import { Icon, SelectButton, SelectButtonGroup } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { writable } from 'svelte/store';

  export let disabled = false;
  /**
   * @type {import('svelte/store').Writable<EntryView>}
   */
  export let currentView = writable({});
</script>

<SelectButtonGroup {disabled} ariaLabel={$_('switch_view')}>
  <SelectButton
    {disabled}
    selected={$currentView.type !== 'grid'}
    class="ghost iconic"
    on:click={() => {
      currentView.update((view) => ({
        ...view,
        type: 'list',
      }));
    }}
  >
    <Icon slot="start-icon" name="format_list_bulleted" label={$_('list_view')} />
  </SelectButton>
  <SelectButton
    {disabled}
    selected={$currentView.type === 'grid'}
    class="ghost iconic"
    on:click={() => {
      currentView.update((view) => ({
        ...view,
        type: 'grid',
      }));
    }}
  >
    <Icon slot="start-icon" name="grid_view" label={$_('grid_view')} />
  </SelectButton>
</SelectButtonGroup>
