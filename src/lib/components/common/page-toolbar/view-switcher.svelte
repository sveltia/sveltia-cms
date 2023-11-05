<script>
  import { Icon, SelectButton, SelectButtonGroup } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { writable } from 'svelte/store';

  export let disabled = false;
  /**
   * @type {import('svelte/store').Writable<EntryListView | AssetListView | SelectAssetsView>}
   */
  export let currentView = writable({});
</script>

<SelectButtonGroup {disabled} aria-label={$_('switch_view')}>
  <SelectButton
    {disabled}
    selected={$currentView.type !== 'grid'}
    variant="ghost"
    iconic
    on:select={() => {
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
    variant="ghost"
    iconic
    on:select={() => {
      currentView.update((view) => ({
        ...view,
        type: 'grid',
      }));
    }}
  >
    <Icon slot="start-icon" name="grid_view" label={$_('grid_view')} />
  </SelectButton>
</SelectButtonGroup>
