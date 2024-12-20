<script>
  import { Checkbox } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';

  /**
   * @typedef {object} Props
   * @property {(Entry | Asset)[]} allItems - All available items.
   * @property {import('svelte/store').Writable<(Entry | Asset)[]>} selectedItems - Selected items.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    allItems,
    selectedItems,
    /* eslint-enable prefer-const */
  } = $props();

  const totalCount = $derived(allItems.length);
  const selectedCount = $derived($selectedItems.length);
  const anySelected = $derived(!!selectedCount);
  const allSelected = $derived(anySelected && selectedCount === totalCount);
</script>

<div role="none" class="wrapper">
  <Checkbox
    disabled={!totalCount}
    aria-label={$_('select_all')}
    checked={anySelected && !allSelected ? 'mixed' : anySelected}
    onChange={() => {
      // Use `set` because assignment doesn’t work with Runes
      selectedItems.set(allSelected ? [] : [...allItems]);
    }}
  />
  {#if anySelected}
    <span role="none">
      {$_('x_of_x_selected', { values: { total: totalCount, selected: selectedCount } })}
    </span>
  {/if}
</div>

<style lang="scss">
  .wrapper {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-inline: 8px;
  }

  span {
    color: var(--sui-secondary-foreground-color);
    font-size: var(--sui-font-size-small);
  }
</style>
