import {
  getDropIndex,
  getListItemAt,
  getMoveTarget,
  moveListItem,
  startAutoScroll,
  stopAutoScroll,
} from '$lib/services/utils/drag-sorting';

/**
 * Reactive state and event handlers of a sortable list, created with {@link createDragSorter}.
 * @typedef {object} DragSorter
 * @property {number | undefined} grabbedIndex Index of the item made draggable by its handle.
 * @property {number | undefined} dragIndex Index of the item currently being dragged.
 * @property {number[]} displayOrder The order the items are rendered in.
 * @property {(index: number) => void} grab Make the item at the given index draggable.
 * @property {() => void} release Make no item draggable.
 * @property {(index: number, event?: DragEvent, data?: string) => void} onDragStart Start
 * dragging the item at the given index.
 * @property {(event: DragEvent) => void} onDragOver Handle a `dragover` event on the list.
 * @property {(event: DragEvent) => void} onDrop Handle a `drop` event on the list.
 * @property {() => void} onDragEnd End the drag.
 */

/**
 * Create the reactive state and event handlers of a list whose items can be reordered by dragging
 * them. The list element must have the items as its direct children, rendered in `displayOrder`.
 *
 * The list-level `dragover` and `drop` handlers should be attached in the capture phase, so that a
 * drop zone or another sortable list nested in an item — a File subfield, say — never sees a
 * reorder drag and doesn’t light up as a drop target. Anything else being dragged, such as a file
 * from the desktop, is passed through untouched.
 * @param {object} args Arguments.
 * @param {() => number} args.getItemCount Function returning the number of items in the list.
 * @param {() => HTMLElement | undefined} args.getListElement Function returning the list element.
 * @param {(from: number, to: number) => void} args.onMove Function called with the source and
 * destination indexes once an item has been dropped somewhere else.
 * @returns {DragSorter} Reactive state and event handlers.
 */
export const createDragSorter = ({ getItemCount, getListElement, onMove }) => {
  /** @type {number | undefined} */
  let grabbedIndex = $state();
  /**
   * The drag in progress: the index of the item being dragged, and the item indexes in the order
   * they are displayed meanwhile. `undefined` while no drag is in progress.
   * @type {{ index: number, previewOrder: number[] } | undefined}
   */
  let drag = $state.raw();

  const displayOrder = $derived.by(() => {
    const itemCount = getItemCount();

    return drag?.previewOrder.length === itemCount
      ? drag.previewOrder
      : [...Array(itemCount).keys()];
  });

  /**
   * Reset the state, so nothing is dragged or draggable.
   */
  const reset = () => {
    stopAutoScroll();
    grabbedIndex = undefined;
    drag = undefined;
  };

  return {
    /**
     * Index of the item made draggable by a press on its drag handle. Only the handle starts a
     * drag, so the rest of the item stays selectable and its own controls keep working.
     * @returns {number | undefined} Index.
     */
    get grabbedIndex() {
      return grabbedIndex;
    },
    /**
     * Index of the item currently being dragged.
     * @returns {number | undefined} Index.
     */
    get dragIndex() {
      return drag?.index;
    },
    /**
     * The order the items are rendered in. This is the identity order except during a drag, when it
     * holds the provisional order, so the other items slide out of the way and the gap the dragged
     * item would land in follows the pointer. A stale preview left over from a list that changed
     * length underneath is discarded.
     * @returns {number[]} Item indexes.
     */
    get displayOrder() {
      return displayOrder;
    },
    /**
     * Make the item at the given index draggable. Call it when its drag handle is pressed.
     * @param {number} index Item index.
     */
    grab: (index) => {
      grabbedIndex = index;
    },
    /**
     * Make no item draggable. Call it when the drag handle is released.
     */
    release: () => {
      grabbedIndex = undefined;
    },
    /**
     * Start dragging the item at the given index. Call it from the item’s `dragstart` event.
     * @param {number} index Item index.
     * @param {DragEvent} [event] `dragstart` event. When given, the drag is marked as a move, and
     * the given data is attached to it, because Firefox doesn’t start a drag unless some data is
     * attached.
     * @param {string} [data] Plain text describing the item, to be attached to the drag.
     */
    onDragStart: (index, event, data) => {
      drag = { index, previewOrder: [...displayOrder] };
      // Let the editor pane scroll while the pointer is dragged near its top or bottom edge, so a
      // long list can be reordered without letting go
      startAutoScroll(getListElement());

      if (event?.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        // Firefox doesn’t start a drag unless some data is attached to it
        event.dataTransfer.setData('text/plain', data ?? '');
      }
    },
    /**
     * Handle a `dragover` event on the list, moving the dragged item’s gap under the pointer.
     * @param {DragEvent} event `dragover` event.
     */
    onDragOver: (event) => {
      if (!drag) {
        return;
      }

      event.stopPropagation();
      // The browser rejects the drop and never fires the `drop` event unless the default is
      // prevented
      event.preventDefault();

      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move';
      }

      const item = getListItemAt({ target: event.target, listElement: getListElement() });

      // Keep the current order while the pointer is over a gap between two items
      if (!item) {
        return;
      }

      const { index, previewOrder } = drag;
      const from = previewOrder.indexOf(index);

      const to = getMoveTarget({
        dragIndex: from,
        dropIndex: getDropIndex({
          index: item.index,
          clientY: event.clientY,
          rect: item.element.getBoundingClientRect(),
        }),
      });

      if (to !== undefined) {
        drag = { index, previewOrder: moveListItem(previewOrder, from, to) };
      }
    },
    /**
     * Handle a `drop` event on the list, committing the previewed order.
     * @param {DragEvent} event `drop` event.
     */
    onDrop: (event) => {
      if (!drag) {
        return;
      }

      event.stopPropagation();
      event.preventDefault();

      const { index: from, previewOrder } = drag;
      // Where the item ended up in the preview is where it should be committed
      const to = previewOrder.indexOf(from);

      // The committed order matches the preview, so the items don’t move again on the way out
      reset();

      if (to !== from) {
        onMove(from, to);
      }
    },
    /**
     * End the drag. Call it from the item’s `dragend` event, which fires whether the item was
     * dropped or the drag was cancelled; a cancelled drag puts every item back where it started.
     */
    onDragEnd: reset,
  };
};
