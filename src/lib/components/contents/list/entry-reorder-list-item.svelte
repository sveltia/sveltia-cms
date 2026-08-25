<!--
  @component
  Render the contents of an entry row in reorder mode: the regular list cells, plus the Move Up /
  Move Down buttons that reorder the entry without a pointer.

  The row element itself lives in `entry-reorder-list.svelte`. It has to be a plain element there —
  `animate:` only works on an element at the top level of a keyed `each` block, never on a component
  — so the drag handling stays with the list and this component supplies only what goes inside.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Button, GridCell, Icon } from '@sveltia/ui';

  import EntryListItemCells from '$lib/components/contents/list/entry-list-item-cells.svelte';

  /**
   * @import { Entry, InternalEntryCollection, ViewType } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {InternalEntryCollection} collection Selected collection.
   * @property {Entry} entry Entry.
   * @property {ViewType} viewType View type.
   * @property {boolean} [canMoveUp] Whether the Move Up action is available.
   * @property {boolean} [canMoveDown] Whether the Move Down action is available.
   * @property {() => void} [onMoveUp] Move up handler.
   * @property {() => void} [onMoveDown] Move down handler.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    collection,
    entry,
    viewType,
    canMoveUp = false,
    canMoveDown = false,
    onMoveUp = undefined,
    onMoveDown = undefined,
    /* eslint-enable prefer-const */
  } = $props();
</script>

<EntryListItemCells {collection} {entry} {viewType} />
<GridCell class="reorder-actions">
  <Button
    variant="ghost"
    iconic
    disabled={!canMoveUp}
    aria-label={_('move_up')}
    onclick={(event) => {
      event.stopPropagation();
      onMoveUp?.();
    }}
  >
    {#snippet startIcon()}
      <Icon name="arrow_upward" />
    {/snippet}
  </Button>
  <Button
    variant="ghost"
    iconic
    disabled={!canMoveDown}
    aria-label={_('move_down')}
    onclick={(event) => {
      event.stopPropagation();
      onMoveDown?.();
    }}
  >
    {#snippet startIcon()}
      <Icon name="arrow_downward" />
    {/snippet}
  </Button>
</GridCell>
