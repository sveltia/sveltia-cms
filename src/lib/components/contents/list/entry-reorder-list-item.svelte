<!--
  @component
  Render an entry row in reorder mode: draggable, with Move Up / Move Down buttons.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Button, GridCell, GridRow, Icon } from '@sveltia/ui';

  import EntryListItemCells from '$lib/components/contents/list/entry-list-item-cells.svelte';
  import { listedEntries } from '$lib/services/contents/collection/view';

  /**
   * @import { Entry, InternalEntryCollection, ViewType } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {InternalEntryCollection} collection Selected collection.
   * @property {Entry} entry Entry.
   * @property {ViewType} viewType View type.
   * @property {boolean} [dragging] Whether this item is currently being dragged.
   * @property {boolean} [dropBefore] Whether to show a drop indicator before this item.
   * @property {boolean} [dropAfter] Whether to show a drop indicator after this item.
   * @property {boolean} [canMoveUp] Whether the Move Up action is available.
   * @property {boolean} [canMoveDown] Whether the Move Down action is available.
   * @property {() => void} [onDragStart] Drag start handler.
   * @property {(clientY: number, rect: DOMRect) => void} [onDragOver] Drag over handler.
   * @property {() => void} [onDrop] Drop handler.
   * @property {() => void} [onDragEnd] Drag end handler.
   * @property {() => void} [onMoveUp] Move up handler.
   * @property {() => void} [onMoveDown] Move down handler.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    collection,
    entry,
    viewType,
    dragging = false,
    dropBefore = false,
    dropAfter = false,
    canMoveUp = false,
    canMoveDown = false,
    onDragStart = undefined,
    onDragOver = undefined,
    onDrop = undefined,
    onDragEnd = undefined,
    onMoveUp = undefined,
    onMoveDown = undefined,
    /* eslint-enable prefer-const */
  } = $props();
</script>

<GridRow
  aria-rowindex={$listedEntries.indexOf(entry)}
  class={[dragging && 'drag-source', dropBefore && 'drop-before', dropAfter && 'drop-after']
    .filter(Boolean)
    .join(' ')}
  draggable
  ondragstart={(/** @type {DragEvent} */ event) => {
    onDragStart?.();

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
  }}
  ondragover={(/** @type {DragEvent & { currentTarget: HTMLElement }} */ event) => {
    event.preventDefault();

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }

    onDragOver?.(event.clientY, event.currentTarget.getBoundingClientRect());
  }}
  ondrop={(/** @type {DragEvent} */ event) => {
    event.preventDefault();
    onDrop?.();
  }}
  ondragend={() => {
    onDragEnd?.();
  }}
>
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
</GridRow>
