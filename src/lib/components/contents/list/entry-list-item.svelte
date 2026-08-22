<!--
  @component
  Render a read-only entry row. Clicking the row navigates to the entry edit page.
-->
<script>
  import { GridRow } from '@sveltia/ui';

  import EntryListItemCells from '$lib/components/contents/list/entry-list-item-cells.svelte';
  import { goto } from '$lib/services/app/navigation';
  import { selectedEntries } from '$lib/services/contents/collection/entries';
  import { listedEntryIndexMap } from '$lib/services/contents/collection/view';
  import { openAuthoring } from '$lib/services/workflow/open-authoring';

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

  // `undefined` for an entry that has never been published, as those are listed in a separate group
  // above `listedEntries`. The attribute is then omitted rather than set to an invalid index.
  const rowIndex = $derived($listedEntryIndexMap.get(entry.id));

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
  aria-rowindex={rowIndex}
  onChange={(event) => {
    updateSelection(event.detail.selected);
  }}
  onclick={() => {
    goto(`/collections/${collection.name}/entries/${entry.subPath}`, {
      transitionType: 'forwards',
    });
  }}
>
  <!-- Deleting entries is the only bulk action, and it’s not available to an Open Authoring
  contributor, so the selection checkboxes would do nothing for them -->
  <EntryListItemCells
    {collection}
    {entry}
    {viewType}
    showCheckbox={!$openAuthoring}
    onSelect={updateSelection}
  />
</GridRow>
