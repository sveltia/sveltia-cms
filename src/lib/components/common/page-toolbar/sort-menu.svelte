<script>
  import { Menu, MenuButton, MenuItemRadio } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { getFieldConfig } from '$lib/services/contents/entry/fields';

  /**
   * @typedef {object} Props
   * @property {import('svelte/store').Writable<EntryListView | AssetListView>} currentView -
   * Current view details.
   * @property {string} aria-controls - The `aria-controls` attribute for the menu.
   * @property {string} [label] - Menu button label.
   * @property {boolean} [disabled] - Whether to disable the button.
   * @property {{ label: string, key: string }[]} [fields] - Sorting fields.
   * @property {string | undefined} [collectionName] - Current collection name.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    currentView,
    'aria-controls': ariaControls,
    label = '',
    disabled = false,
    fields = [],
    collectionName = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  /** @type {SortOrder[]} */
  const sortOrders = ['ascending', 'descending'];
  const dateFields = ['date', 'commit_date'];
</script>

<MenuButton variant="ghost" label={label || $_('sort')} {disabled} popupPosition="bottom-right">
  {#snippet popup()}
    <Menu aria-label={$_('sorting_options')} aria-controls={ariaControls}>
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
