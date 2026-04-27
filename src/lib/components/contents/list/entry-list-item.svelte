<!--
  @component
  Render a read-only entry row. Clicking the row navigates to the entry edit page.
-->
<script>
  import { GridRow } from '@sveltia/ui';

  import EntryListItemCells from '$lib/components/contents/list/entry-list-item-cells.svelte';
  import { goto } from '$lib/services/app/navigation';
  import { selectedEntries } from '$lib/services/contents/collection/entries';
  import { listedEntries } from '$lib/services/contents/collection/view';

  /**
   * @import { Entry, InternalEntryCollection, ViewType } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {InternalEntryCollection} collection Selected collection.
   * @property {Entry} entry Entry.
   * @property {ViewType} viewType View type.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    collection,
    entry,
    viewType,
    /* eslint-enable prefer-const */
  } = $props();

  /**
   * Update the entry selection.
   * @param {boolean} selected Whether the current entry item is selected.
   */
  const updateSelection = (selected) => {
    selectedEntries.update((entries) => {
      const index = entries.indexOf(entry);

      if (selected && index === -1) {
        entries.push(entry);
      }

      if (!selected && index > -1) {
        entries.splice(index, 1);
      }

      return entries;
    });
  };
</script>

<GridRow
  aria-rowindex={$listedEntries.indexOf(entry)}
  onChange={(event) => {
    updateSelection(event.detail.selected);
  }}
  onclick={() => {
    goto(`/collections/${collection.name}/entries/${entry.subPath}`, {
      transitionType: 'forwards',
    });
  }}
>
  <EntryListItemCells {collection} {entry} {viewType} showCheckbox onSelect={updateSelection} />
</GridRow>
