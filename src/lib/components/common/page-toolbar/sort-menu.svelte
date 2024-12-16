<script>
  import { Menu, MenuButton, MenuItemRadio } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { getFieldConfig } from '$lib/services/contents/entry/fields';

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
  /**
   * @type {string | undefined}
   */
  export let collectionName = undefined;

  /** @type {SortOrder[]} */
  const sortOrders = ['ascending', 'descending'];
  const dateFields = ['date', 'commit_date'];
</script>

<MenuButton variant="ghost" label={label || $_('sort')} {disabled} popupPosition="bottom-right">
  {#snippet popup()}
    <Menu aria-label={$_('sorting_options')} aria-controls={$$restProps['aria-controls']}>
      {#each fields as { key, label: _label } (key)}
        {#each sortOrders as order (order)}
          <MenuItemRadio
            label={$_(
              dateFields.includes(key) ||
                (!!collectionName &&
                  getFieldConfig({ collectionName, keyPath: key })?.widget === 'datetime')
                ? `${order}_date`
                : order,
              { values: { label: _label } },
            )}
            checked={$currentView.sort?.key === key && $currentView.sort?.order === order}
            onSelect={() => {
              currentView.update((view) => ({ ...view, sort: { key, order } }));
            }}
          />
        {/each}
      {/each}
    </Menu>
  {/snippet}
</MenuButton>
