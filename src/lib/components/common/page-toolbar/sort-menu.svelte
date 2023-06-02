<script>
  import { Icon, Menu, MenuButton, MenuItemGroup, MenuItemRadio, Separator } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { writable } from 'svelte/store';

  export let label = '';
  export let disabled = false;
  /**
   * @type {import('svelte/store').Writable<EntryView>}
   */
  export let currentView = writable({});
  /**
   * @type {{ label: string, key: string }[]}
   */
  export let fields = [];
</script>

<MenuButton class="ghost" label={label || $_('sort_by')} {disabled}>
  <Icon slot="end-icon" name="arrow_drop_down" />
  <Menu slot="popup">
    <MenuItemGroup ariaLabel={$_('sort_field')}>
      {#each fields as { key, label: _label } (key)}
        <MenuItemRadio
          label={_label}
          checked={$currentView.sort?.key === key}
          on:click={() => {
            // Sort dates from new to old by default
            const order = ['date', 'commit_date'].includes(key) ? 'descending' : 'ascending';

            currentView.update((view) => ({
              ...view,
              sort: { key, order },
            }));
          }}
        />
      {/each}
    </MenuItemGroup>
    <Separator />
    <MenuItemGroup ariaLabel={$_('sort_order')}>
      {#each ['ascending', 'descending'] as order}
        <MenuItemRadio
          label={$_(order)}
          disabled={!$currentView.sort}
          checked={$currentView.sort?.order === order}
          on:click={() => {
            currentView.update((view) => ({
              ...view,
              // eslint-disable-next-line object-shorthand
              sort: { key: $currentView.sort?.key, order: /** @type {SortOrder} */ (order) },
            }));
          }}
        />
      {/each}
    </MenuItemGroup>
  </Menu>
</MenuButton>
