<script>
  import { _ } from '@sveltia/i18n';
  import { Divider, Menu, MenuButton, MenuItemRadio } from '@sveltia/ui';

  import { DATE_FIELDS, SORT_ORDERS } from '$lib/services/contents/collection/view/sort-keys';
  import { getField } from '$lib/services/contents/entry/fields';

  /**
   * @import { AssetListView, EntryListView, SortKey } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {{ current: EntryListView | AssetListView }} currentView Current view details.
   * @property {string} aria-controls The `aria-controls` attribute for the menu.
   * @property {string} [label] Menu button label.
   * @property {boolean} [disabled] Whether to disable the button.
   * @property {SortKey[]} [sortKeys] Sort keys to display in the menu.
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

  /**
   * Get the localized label for a sort order, worded for the type of the sorted value.
   * @param {SortKey} sortKey Sort key.
   * @param {string} order Sort order.
   * @returns {string} Label.
   */
  const getOrderLabel = ({ key, label: _label, type }, order) => {
    const isDate =
      type === 'date' ||
      DATE_FIELDS.includes(key) ||
      (!!collectionName && getField({ collectionName, keyPath: key })?.widget === 'datetime');

    const suffix = isDate ? '_date' : type === 'number' ? '_number' : '';

    return _(`${order}${suffix}`, { values: { label: _label } });
  };
</script>

<MenuButton variant="ghost" label={label || _('sort')} {disabled} popupPosition="bottom-right">
  {#snippet popup()}
    <Menu aria-label={_('sorting_options')} aria-controls={ariaControls}>
      {#each sortKeys as sortKey (sortKey.key)}
        {@const { key } = sortKey}
        {#each SORT_ORDERS as order (order)}
          <MenuItemRadio
            label={getOrderLabel(sortKey, order)}
            checked={currentView.current.sort?.key === key &&
              currentView.current.sort.order === order}
            onSelect={() => {
              currentView.current = { ...currentView.current, sort: { key, order } };
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
