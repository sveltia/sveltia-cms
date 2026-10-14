<!--
  @component
  Render the entry list in bulk edit mode: a spreadsheet-like table with a row for each listed entry
  and a column for each field that can be edited in bulk, holding the field’s own control. The
  edits are kept in the `bulkEdits` store until the toolbar Save button writes them in one commit.

  The entries are snapshotted when the mode is entered, in the order and groups of the current view,
  so a background refresh doesn’t move the rows from under the user. The view can’t be changed while
  the mode is on, as the secondary toolbar is hidden.
-->
<script>
  import { _, locale as appLocale } from '@sveltia/i18n';
  import { InfiniteScroll, TruncatedText } from '@sveltia/ui';
  import { onMount } from 'svelte';

  import BulkEditCell from '$lib/components/contents/list/bulk-edit-cell.svelte';
  import { getGroupLabel } from '$lib/services/common/view';
  import {
    getBulkEditValue,
    isBulkEditableEntry,
    setBulkEditValue,
    validateBulkEdits,
  } from '$lib/services/contents/collection/entries/bulk-edit';
  import { getBulkEditableFields } from '$lib/services/contents/collection/entries/bulk-edit/config';
  import {
    bulkEditedEntries,
    bulkEditErrors,
    bulkEdits,
    bulkEditSaving,
    entryGroups,
  } from '$lib/services/contents/collection/view';
  import { setEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import { getEntrySummary } from '$lib/services/contents/entry/summary';

  /**
   * @import { Entry, InternalEntryCollection } from '$lib/types/private';
   * @import { EntryDraftState } from '$lib/services/contents/draft/state.svelte';
   * @import { FieldKeyPath } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {InternalEntryCollection} collection Selected entry collection.
   */

  /** @type {Props} */
  const { collection } = $props();

  // The field controls are those of the entry editor, some of which look for the draft being
  // edited, e.g. to offer the entries a Relation field can create. There is no draft here, as the
  // values are kept in the bulk edits, so the controls are given an empty one
  setEntryDraftContext(/** @type {EntryDraftState} */ ({ current: undefined }));

  const fields = $derived(getBulkEditableFields(collection));
  const locale = $derived(collection._i18n.defaultLocale);

  /**
   * Entry groups as they were when the mode was entered, without the entries that can’t be edited.
   * @type {{ name: string, entries: Entry[] }[]}
   */
  let groups = $state.raw([]);

  /**
   * Record a new value of a field, and validate the edits again if the user has been told some of
   * them are invalid, so a fixed field stops being reported.
   * @param {Entry} entry Entry.
   * @param {FieldKeyPath} keyPath Field name.
   * @param {any} value New value.
   */
  const updateValue = (entry, keyPath, value) => {
    bulkEdits.current = setBulkEditValue({
      collection,
      entry,
      keyPath,
      value,
      edits: bulkEdits.current,
    });

    if (Object.keys(bulkEditErrors.current).length) {
      bulkEditErrors.current = validateBulkEdits({
        collection,
        entries: bulkEditedEntries.current,
        edits: bulkEdits.current,
      });
    }
  };

  /* v8 ignore start -- the app locale is always set once the UI strings are loaded */
  /**
   * Get the plain-text summary of an entry, which names its controls. `appLocale.current` is a key,
   * because the summary can include a localized label.
   * @param {Entry} entry Entry.
   * @returns {string} Summary.
   */
  const getSummary = (entry) => (appLocale.current ? getEntrySummary(collection, entry) : '');
  /* v8 ignore stop */

  /**
   * 1-based `aria-rowindex` of each entry, keyed by entry ID, after the header row.
   */
  const rowIndexMap = $derived(
    new Map(bulkEditedEntries.current.map((entry, index) => [entry.id, index + 2])),
  );

  // Snapshot the entry groups once, when the mode is entered. See the component description
  onMount(() => {
    groups = entryGroups.current
      .map(({ name, entries }) => ({
        name,
        entries: entries.filter((entry) => isBulkEditableEntry(collection, entry)),
      }))
      .filter(({ entries }) => entries.length);

    bulkEditedEntries.current = groups.flatMap(({ entries }) => entries);
  });
</script>

<div role="none" class="wrapper">
  <div
    role="table"
    class="table"
    aria-label={_('bulk_edit_table')}
    aria-rowcount={bulkEditedEntries.current.length + 1}
    style:--column-count={fields.length}
  >
    <div role="row" class="row header" aria-rowindex={1}>
      <div role="columnheader" class="cell title">{_('bulk_edit_entry')}</div>
      {#each fields as { name, label } (name)}
        <div role="columnheader" class="cell">{label || name}</div>
      {/each}
      <div role="none" class="cell filler"></div>
    </div>
    {#each groups as { name, entries } (name)}
      {@const groupLabel = name !== '*' ? getGroupLabel(name) : undefined}
      <!-- The group is named by its row group, so its header isn’t a row that would throw off the
      row count and indexes -->
      <div role="rowgroup" class="rowgroup" aria-label={groupLabel}>
        {#if groupLabel}
          <div class="group-header" aria-hidden="true">{groupLabel}</div>
        {/if}
        <InfiniteScroll items={entries} itemKey="id">
          {#snippet renderItem(/** @type {Entry} */ entry)}
            {@const summary = getSummary(entry)}
            <div role="row" class="row" aria-rowindex={rowIndexMap.get(entry.id)}>
              <div role="rowheader" class="cell title">
                <TruncatedText lines={2}>
                  <!-- `appLocale.current` is a key, because the summary can include a localized
                label -->
                  {#key appLocale.current}
                    <bdi>
                      {@html getEntrySummary(collection, entry, {
                        useTemplate: true,
                        allowMarkdown: true,
                      })}
                    </bdi>
                  {/key}
                </TruncatedText>
              </div>
              {#each fields as fieldConfig (fieldConfig.name)}
                {@const keyPath = fieldConfig.name}
                {@const edits = bulkEdits.current[entry.id]}
                <div role="cell" class="cell">
                  <BulkEditCell
                    {locale}
                    {fieldConfig}
                    entryLabel={summary}
                    value={getBulkEditValue({
                      collection,
                      entry,
                      keyPath,
                      edits: bulkEdits.current,
                    })}
                    edited={!!edits && Object.hasOwn(edits, keyPath)}
                    errors={bulkEditErrors.current[entry.id]?.[keyPath]}
                    readonly={bulkEditSaving.current}
                    onChange={(value) => {
                      updateValue(entry, keyPath, value);
                    }}
                  />
                </div>
              {/each}
              <div role="none" class="cell filler"></div>
            </div>
          {/snippet}
        </InfiniteScroll>
      </div>
    {/each}
  </div>
</div>

<style>
  .wrapper {
    height: 100%;
    overflow: auto;
    overscroll-behavior: contain;
  }

  .table {
    display: grid;
    /* The entry titles, a column sized to its control for each field, and a filler taking up the
      rest of the width so the row borders run across the list */
    grid-template-columns: minmax(160px, 280px) repeat(var(--column-count), max-content) 1fr;
    width: max-content;
    min-width: 100%;

    :global {
      .spinner {
        grid-column: 1 / -1;
      }
    }
  }

  .rowgroup,
  .row {
    display: contents;
  }

  .group-header {
    grid-column: 1 / -1;
    border-bottom: 1px solid var(--sui-secondary-border-color);
    padding: 4px 8px;
    font-weight: var(--sui-font-weight-bold);
    background-color: var(--sui-secondary-background-color);
  }

  .cell {
    display: flex;
    align-items: center;
    border-bottom: 1px solid var(--sui-secondary-border-color);
    padding: 4px 8px;
    min-width: 0;

    &.filler {
      padding: 0;
    }

    /* The entry titles stay in view as the table is scrolled sideways, like a frozen column */
    &.title {
      position: sticky;
      inset-inline-start: 0;
      z-index: 1;
      border-inline-end: 1px solid var(--sui-secondary-border-color);
      background-color: var(--sui-primary-background-color);
    }
  }

  .header .cell {
    position: sticky;
    top: 0;
    z-index: 2;
    background-color: var(--sui-primary-background-color);
    font-size: var(--sui-font-size-small);
    font-weight: var(--sui-font-weight-bold);

    &.title {
      z-index: 3;
    }
  }
</style>
