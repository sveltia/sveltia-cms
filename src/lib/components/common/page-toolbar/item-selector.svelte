<script>
  import { _ } from '@sveltia/i18n';
  import { Checkbox } from '@sveltia/ui';

  /**
   * @import { Asset, Entry, ExternalAsset } from '$lib/types/private';
   */

  /**
   * @typedef {Entry | Asset | ExternalAsset} Item
   */

  /**
   * @typedef {object} Props
   * @property {Item[]} allItems All available items.
   * @property {{ current: Item[] }} selectedItems Selected items.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    allItems,
    selectedItems,
    /* eslint-enable prefer-const */
  } = $props();

  const totalCount = $derived(allItems.length);
  const selectedCount = $derived(selectedItems.current.length);
  const anySelected = $derived(!!selectedCount);
  const allSelected = $derived(anySelected && selectedCount === totalCount);
</script>

<div role="none" class="wrapper">
  <Checkbox
    disabled={!totalCount}
    aria-label={_('select_all')}
    checked={anySelected && !allSelected ? 'mixed' : anySelected}
    onChange={() => {
      selectedItems.current = allSelected ? [] : [...allItems];
    }}
  />
  {#if anySelected}
    <span role="none">
      {_('x_of_x_selected', { values: { total: totalCount, selected: selectedCount } })}
    </span>
  {/if}
</div>

<style>
  .wrapper {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-inline: 20px;
  }

  span {
    color: var(--sui-secondary-foreground-color);
    font-size: var(--sui-font-size-small);
  }
</style>
