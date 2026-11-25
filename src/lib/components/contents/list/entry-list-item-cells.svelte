<!--
  @component
  Shared cells (checkbox, thumbnail image, title) used by both the read-only entry list row and the
  reorder list row. In the table view, the title is replaced by a cell for each column.
-->
<script>
  import { _, locale as appLocale } from '@sveltia/i18n';
  import { Checkbox, GridCell, Icon, TruncatedText } from '@sveltia/ui';

  import EntryStatusCell from '$lib/components/contents/list/entry-status-cell.svelte';
  import EntryThumbnail from '$lib/components/contents/shared/entry-thumbnail.svelte';
  import { selectedEntryIdSet } from '$lib/services/contents/collection/entries';
  import {
    getIndexFile,
    isCollectionIndexFile,
  } from '$lib/services/contents/collection/entries/index-file';
  import { getTableCellValue } from '$lib/services/contents/collection/view/table';
  import { SUMMARY_COLUMN_KEY } from '$lib/services/contents/collection/view/table-keys';
  import { getEntrySummary } from '$lib/services/contents/entry/summary';
  import { env } from '$lib/services/user/env.svelte';

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
   * @property {boolean} [showCheckbox] Whether to render the selection checkbox cell. Defaults to
   * `false`; the read-only list row passes `true`, while the reorder row leaves it off.
   * @property {(selected: boolean) => void} [onSelect] Selection change handler.
   * @property {EntryTableColumn[]} [columns] Columns of the table view, which take the place of the
   * title. Only used when `viewType` is `table`.
   * @property {boolean} [showPreviewLink] Whether to render a button opening the entry on the live
   * site or its deploy preview after its status. Defaults to `false`; the read-only list row
   * passes `true`, while the reorder row, which is dragged around, leaves it off.
   */

  /** @type {Props} */
  let {
    collection,
    entry,
    viewType,
    showCheckbox = false,
    onSelect = undefined,
    columns = [],
    showPreviewLink = false,
  } = $props();

  /* v8 ignore start -- the app locale is always set once the UI strings are loaded */
  // Plain-text summary naming the selection checkbox, so a screen reader hears which entry it
  // selects rather than an unlabelled checkbox. `appLocale.current` is a key, because the summary
  // can include a localized label
  const summary = $derived(appLocale.current ? getEntrySummary(collection, entry) : '');
  /* v8 ignore stop */
</script>

{#snippet title()}
  <GridCell class="title">
    <div role="none" class="label">
      <TruncatedText lines={2}>
        {#key appLocale.current}
          <bdi>
            {@html getEntrySummary(collection, entry, { useTemplate: true, allowMarkdown: true })}
          </bdi>
        {/key}
        {#if isCollectionIndexFile(collection, entry)}
          <Icon name={getIndexFile(collection)?.icon} class="home" />
        {/if}
      </TruncatedText>
    </div>
  </GridCell>
{/snippet}

{#if showCheckbox && !(env.isSmallScreen || env.isMediumScreen)}
  <GridCell class="checkbox">
    <Checkbox
      tabindex="-1"
      ariaLabel={_('select_item', { values: { name: summary } })}
      checked={selectedEntryIdSet.current.has(entry.id)}
      onChange={({ detail: { checked } }) => {
        onSelect?.(checked);
      }}
    />
  </GridCell>
{/if}
{#if collection._thumbnailFieldNames.length}
  <GridCell class="image">
    <EntryThumbnail {collection} {entry} variant={viewType === 'grid' ? 'tile' : 'icon'} />
  </GridCell>
{/if}
{#if viewType === 'table'}
  {#each columns as column (column.key)}
    {#if column.key === SUMMARY_COLUMN_KEY}
      {@render title()}
    {:else}
      {@const { type, value } = getTableCellValue({ collection, entry, column })}
      <GridCell class="column" data-key={column.key}>
        {#if type === 'boolean'}
          {#if value}
            <Icon name="check" role="img" aria-label={_('boolean.true')} />
          {/if}
        {:else}
          <div role="none" class="label">
            <TruncatedText><bdi>{value}</bdi></TruncatedText>
          </div>
        {/if}
      </GridCell>
    {/if}
  {/each}
{:else}
  {@render title()}
{/if}
<EntryStatusCell {collection} subPath={entry.subPath} {entry} {showPreviewLink} />

<style>
  .label {
    :global {
      .icon.home {
        opacity: 0.5;
        font-size: 20px;
        vertical-align: -4px;
      }
    }
  }
</style>
