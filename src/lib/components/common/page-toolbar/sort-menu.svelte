<script>
  import { _ } from '@sveltia/i18n';
  import { Divider, Menu, MenuButton, MenuItemRadio } from '@sveltia/ui';

  import { DATE_FIELDS, SORT_ORDERS } from '$lib/services/contents/collection/view/sort-keys';
  import { getField } from '$lib/services/contents/entry/fields';

  /**
   * @import { Writable } from 'svelte/store';
   * @import { AssetListView, EntryListView } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {Writable<EntryListView | AssetListView>} currentView Current view details.
   * @property {string} aria-controls The `aria-controls` attribute for the menu.
   * @property {string} [label] Menu button label.
   * @property {boolean} [disabled] Whether to disable the button.
   * @property {{ label: string, key: string }[]} [sortKeys] Sort keys to display in the menu.
   * @property {string | undefined} [collectionName] Current collection name.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    currentView,
    'aria-controls': ariaControls,
    label = '',
    disabled = false,
    sortKeys = [],
    collectionName = undefined,
    /* eslint-enable prefer-const */
  } = $props();
</script>

<MenuButton variant="ghost" label={label || _('sort')} {disabled} popupPosition="bottom-right">
  {#snippet popup()}
    <Menu aria-label={_('sorting_options')} aria-controls={ariaControls}>
      {#each sortKeys as { key, label: _label } (key)}
        {#each SORT_ORDERS as order (order)}
          <MenuItemRadio
            label={_(
              DATE_FIELDS.includes(key) ||
                (!!collectionName &&
                  getField({ collectionName, keyPath: key })?.widget === 'datetime')
                ? `${order}_date`
                : order,
              { values: { label: _label } },
            )}
            checked={$currentView.sort?.key === key && $currentView.sort.order === order}
            onSelect={() => {
              currentView.update((view) => ({ ...view, sort: { key, order } }));
            }}
          />
        {/each}
        {#if key === '_summary' && sortKeys.length > 1}
          <Divider />
        {/if}
      {/each}
    </Menu>
  {/snippet}
</MenuButton>
