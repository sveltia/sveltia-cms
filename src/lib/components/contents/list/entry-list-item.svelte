<!--
  @component
  Render a read-only entry row. Clicking the row navigates to the entry edit page.
-->
<script>
  import { locale as appLocale } from '@sveltia/i18n';
  import { GridRow } from '@sveltia/ui';

  import EntryListItemCells from '$lib/components/contents/list/entry-list-item-cells.svelte';
  import { goto } from '$lib/services/app/navigation';
  import { selectedEntries } from '$lib/services/contents/collection/entries';
  import { listedEntryIndexMap } from '$lib/services/contents/collection/view';
  import { getEntrySummary } from '$lib/services/contents/entry/summary';
  import { toggleListItem } from '$lib/services/utils/array';
  import { encodePathSegments } from '$lib/services/utils/url';
  import { openAuthoring } from '$lib/services/workflow/open-authoring';

  /**
   * @import {
   * Entry,
   * EntryTableColumn,
   * InternalEntryCollection,
   * ViewType,
   * } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {InternalEntryCollection} collection Selected collection.
   * @property {Entry} entry Entry.
   * @property {ViewType} viewType View type.
   * @property {EntryTableColumn[]} [columns] Columns of the table view.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    collection,
    entry,
    viewType,
    columns = [],
    /* eslint-enable prefer-const */
  } = $props();

  // `aria-rowindex` is 1-based, unlike the index map. `undefined` for an entry that has never been
  // published, as those are listed in a separate group above `listedEntries`. The attribute is then
  // omitted rather than set to an invalid index.
  const rowIndex = $derived.by(() => {
    const index = listedEntryIndexMap.current.get(entry.id);

    if (index === undefined) {
      return undefined;
    }

    // The table view’s header row comes first
    return viewType === 'table' ? index + 2 : index + 1;
  });

  /* v8 ignore start -- the app locale is always set once the UI strings are loaded */
  // Names the row, so that it’s announced by the entry it holds rather than by the text of every
  // cell, including the selection checkbox’s own label. `appLocale.current` is a key, because the
  // summary can include a localized label
  const summary = $derived(appLocale.current ? getEntrySummary(collection, entry) : '');
  /* v8 ignore stop */

  /**
   * Update the entry selection.
   * @param {boolean} selected Whether the current entry item is selected.
   */
  const updateSelection = (selected) => {
    selectedEntries.current = toggleListItem(selectedEntries.current, entry, selected);
  };
</script>

<GridRow
  aria-rowindex={rowIndex}
  aria-label={summary}
  onChange={(event) => {
    updateSelection(event.detail.selected);
  }}
  onclick={() => {
    goto(encodePathSegments(`/collections/${collection.name}/entries/${entry.subPath}`), {
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
    {columns}
    showCheckbox={!openAuthoring.current}
    onSelect={updateSelection}
  />
</GridRow>
