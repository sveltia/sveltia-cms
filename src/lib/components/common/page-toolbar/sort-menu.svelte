<script>
  import { Icon, Menu, MenuButton, MenuItemRadio } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';

  export let label = '';
  export let disabled = false;
  /**
   * @type {import('svelte/store').Writable<EntryListView | AssetListView>}
   */
  export let currentView;
  /**
   * @type {{ label: string, key: string }[]}
   */
  export let fields = [];

  /** @type {SortOrder[]} */
  const sortOrders = ['ascending', 'descending'];
  const dateFields = ['date', 'commit_date'];
</script>

<MenuButton variant="ghost" label={label || $_('sort')} {disabled}>
  <Icon slot="end-icon" name="arrow_drop_down" />
  <Menu
    slot="popup"
    aria-label={$_('sorting_options')}
    aria-controls={$$restProps['aria-controls']}
  >
    {#each fields as { key, label: _label } (key)}
      {#each sortOrders as order (order)}
        <MenuItemRadio
          label={$_(dateFields.includes(key) ? `${order}_date` : order, {
            values: { label: _label },
          })}
          checked={$currentView.sort?.key === key && $currentView.sort?.order === order}
          on:select={() => {
            currentView.update((view) => ({ ...view, sort: { key, order } }));
          }}
        />
      {/each}
    {/each}
  </Menu>
</MenuButton>
