<!--
  @component
  Render the header row of the entry list’s table view, with a header for each column. A column the
  entries can be sorted by has a button that sorts them, the same way the Sort menu does.
-->
<script>
  import { GridColHeader, GridHead, GridRow } from '@sveltia/ui';

  import { currentView } from '$lib/services/contents/collection/view/settings';
  import { sortKeys } from '$lib/services/contents/collection/view/sort-keys';
  import { getColumnSortKey } from '$lib/services/contents/collection/view/table';

  /**
   * @import { EntryTableColumn, InternalEntryCollection } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {InternalEntryCollection} collection Selected collection.
   * @property {EntryTableColumn[]} columns Columns.
   * @property {boolean} showCheckbox Whether the rows have a selection checkbox cell.
   */

  /** @type {Props} */
  const { collection, columns, showCheckbox } = $props();

  const availableSortKeys = $derived(sortKeys.current.map(({ key }) => key));
</script>

<GridHead>
  <GridRow aria-rowindex={1}>
    {#if showCheckbox}
      <GridColHeader class="checkbox" />
    {/if}
    {#if collection._thumbnailFieldNames.length}
      <GridColHeader class="image" />
    {/if}
    {#each columns as column (column.key)}
      {@const sortKey = getColumnSortKey({ collection, column, sortKeys: availableSortKeys })}
      {@const { sort } = currentView.current}
      {#if sortKey}
        <GridColHeader
          class={column.key === '_summary' ? 'title' : 'column'}
          sortOrder={sort?.key === sortKey ? sort.order : 'none'}
          onSort={(/** @type {CustomEvent} */ event) => {
            currentView.current = {
              ...currentView.current,
              sort: { key: sortKey, order: event.detail.sortOrder },
            };
          }}
        >
          {column.label}
        </GridColHeader>
      {:else}
        <GridColHeader class={column.key === '_summary' ? 'title' : 'column'}>
          {column.label}
        </GridColHeader>
      {/if}
    {/each}
    <GridColHeader class="status" />
  </GridRow>
</GridHead>
