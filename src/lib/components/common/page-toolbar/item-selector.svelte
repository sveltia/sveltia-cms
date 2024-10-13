<script>
  import { Checkbox } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';

  /**
   * @type {(Entry | Asset)[]}
   */
  export let allItems;
  /**
   * @type {import('svelte/store').Writable<(Entry | Asset)[]>}
   */
  export let selectedItems;

  $: totalCount = allItems.length;
  $: selectedCount = $selectedItems.length;
  $: anySelected = !!selectedCount;
  $: allSelected = anySelected && selectedCount === totalCount;
</script>

<div role="none" class="wrapper">
  <Checkbox
    disabled={!totalCount}
    aria-label={$_('select_all')}
    checked={anySelected && !allSelected ? 'mixed' : anySelected}
    onChange={() => {
      $selectedItems = allSelected ? [] : [...allItems];
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
