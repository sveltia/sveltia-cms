/**
 * Helpers for reordering the items of a vertical list with drag and drop.
 *
 * A drop position is expressed as an insertion index: the dragged item will be placed *before* the
 * item at that index, so `0` means before the first item and `itemCount` means after the last one.
 * That representation has one entry per gap, which is what a drop indicator needs, and it keeps the
 * “did this drag actually move anything?” test trivial — see {@link getMoveTarget}.
 */

/**
 * Get the insertion index for a pointer position over a list item. The item’s vertical midpoint
 * splits it into a “drop above” and a “drop below” half.
 * @param {object} args Arguments.
 * @param {number} args.index Index of the item under the pointer.
 * @param {number} args.clientY Vertical pointer position.
 * @param {DOMRect} args.rect Bounding rectangle of the item under the pointer.
 * @returns {number} Insertion index.
 */
export const getDropIndex = ({ index, clientY, rect }) =>
  clientY < rect.top + rect.height / 2 ? index : index + 1;

/**
 * Move an item within a list to another position, without touching the original.
 * @param {any[]} list Original list.
 * @param {number} from Source index.
 * @param {number} to Destination index.
 * @returns {any[]} New list.
 */
export const moveListItem = (list, from, to) => {
  const result = [...list];

  result.splice(to, 0, ...result.splice(from, 1));

  return result;
};

/**
 * Get the destination index of a completed drag.
 * @param {object} args Arguments.
 * @param {number | undefined} args.dragIndex Index of the item being dragged.
 * @param {number | undefined} args.dropIndex Insertion index the item was dropped at.
 * @returns {number | undefined} Destination index, or `undefined` if the drop wouldn’t move the
 * item. Removing the item shifts everything after it down by one, so an insertion index past the
 * dragged item has to be decremented to become a destination index.
 */
export const getMoveTarget = ({ dragIndex, dropIndex }) => {
  if (
    dragIndex === undefined ||
    dropIndex === undefined ||
    dropIndex === dragIndex ||
    dropIndex === dragIndex + 1
  ) {
    return undefined;
  }

  return dropIndex > dragIndex ? dropIndex - 1 : dropIndex;
};

/**
 * Get the destination index for a keyboard shortcut pressed on a drag handle. This is the
 * accessible equivalent of dragging: Arrow Up/Down move the item by one, Home/End send it to either
 * end of the list.
 * @param {object} args Arguments.
 * @param {string} args.key Pressed key.
 * @param {number} args.index Index of the item the handle belongs to.
 * @param {number} args.itemCount Total number of items in the list.
 * @returns {number | undefined} Destination index, or `undefined` if the key isn’t a reorder
 * shortcut or the item is already at the requested position.
 */
export const getKeyboardMoveTarget = ({ key, index, itemCount }) => {
  if (key === 'ArrowUp' || key === 'Home') {
    const target = key === 'ArrowUp' ? index - 1 : 0;

    return index > 0 ? target : undefined;
  }

  if (key === 'ArrowDown' || key === 'End') {
    const target = key === 'ArrowDown' ? index + 1 : itemCount - 1;

    return index < itemCount - 1 ? target : undefined;
  }

  return undefined;
};

/**
 * Find the list item that contains the given drag event target.
 *
 * The list-level drag handlers run in the capture phase so that a nested drop zone or sortable list
 * never sees a reorder drag, which means the event target can be any descendant of an item. Walking
 * up to the direct child of the list element resolves it to the item that owns it, and an item of a
 * nested list resolves to the outer item containing it.
 * @param {object} args Arguments.
 * @param {EventTarget | null} args.target Event target.
 * @param {HTMLElement | undefined} args.listElement Element whose direct children are the list
 * items.
 * @returns {{ element: HTMLElement, index: number } | undefined} The item element and its index, or
 * `undefined` if the target is outside any item of the list.
 */
export const getListItemAt = ({ target, listElement }) => {
  if (
    !listElement ||
    !(target instanceof Element) ||
    target === listElement ||
    !listElement.contains(target)
  ) {
    return undefined;
  }

  /** @type {Element} */
  let element = target;

  // The containment check above guarantees the walk stops at the list element
  while (element.parentElement !== listElement) {
    element = /** @type {Element} */ (element.parentElement);
  }

  return {
    element: /** @type {HTMLElement} */ (element),
    index: [...listElement.children].indexOf(element),
  };
};

/**
 * Distance in pixels from a scroll container’s top or bottom edge where the auto-scroll kicks in.
 */
const AUTO_SCROLL_THRESHOLD = 64;
/**
 * Maximum number of pixels the auto-scroll moves per animation frame, reached at the very edge of
 * the scroll container.
 */
const AUTO_SCROLL_MAX_SPEED = 16;
/**
 * State of the auto-scroll running for the current drag. There can only ever be one drag in
 * progress, so a single module-level slot is enough.
 * @type {{ container: HTMLElement, speed: number, frame: number | undefined } | undefined}
 */
let autoScroll = undefined;

/**
 * Get the nearest scrollable ancestor of the given element — the entry editor pane, in practice.
 * @param {HTMLElement} element Element to start the search from.
 * @returns {HTMLElement | undefined} Scrollable ancestor, or `undefined` if nothing above the
 * element scrolls.
 */
export const getScrollContainer = (element) => {
  let ancestor = element.parentElement;

  while (ancestor) {
    const { overflowY } = globalThis.getComputedStyle(ancestor);

    if (['auto', 'scroll'].includes(overflowY) && ancestor.scrollHeight > ancestor.clientHeight) {
      return ancestor;
    }

    ancestor = ancestor.parentElement;
  }

  return undefined;
};

/**
 * Get the number of pixels the scroll container should move per frame for the given pointer
 * position. The speed ramps up linearly from nothing at the edge of the hot zone to the maximum
 * at the container’s edge, so a slow, precise drop near the middle of the list doesn’t start
 * scrolling.
 * @param {object} args Arguments.
 * @param {number} args.clientY Vertical pointer position.
 * @param {DOMRect} args.rect Bounding rectangle of the scroll container.
 * @returns {number} Pixels per frame. Negative scrolls up, positive scrolls down, `0` doesn’t
 * scroll. A pointer dragged past the container’s edge gets the maximum speed.
 */
export const getAutoScrollSpeed = ({ clientY, rect }) => {
  const distanceFromTop = clientY - rect.top;
  const distanceFromBottom = rect.bottom - clientY;

  if (distanceFromTop < AUTO_SCROLL_THRESHOLD) {
    return -AUTO_SCROLL_MAX_SPEED * (1 - Math.max(distanceFromTop, 0) / AUTO_SCROLL_THRESHOLD);
  }

  if (distanceFromBottom < AUTO_SCROLL_THRESHOLD) {
    return AUTO_SCROLL_MAX_SPEED * (1 - Math.max(distanceFromBottom, 0) / AUTO_SCROLL_THRESHOLD);
  }

  return 0;
};

/**
 * Scroll the container by the current speed and schedule the next frame. The loop parks itself
 * whenever there’s nothing to do — the drag ended, the pointer left the hot zone, or the container
 * reached either end — and {@link onAutoScrollDragOver} starts it again when that changes.
 */
const stepAutoScroll = () => {
  // The frame queued last may outlive the drag, in which case there is nothing left to scroll
  if (!autoScroll) {
    return;
  }

  const { container, speed } = autoScroll;
  const { scrollTop, scrollHeight, clientHeight } = container;
  const nextScrollTop = Math.min(Math.max(scrollTop + speed, 0), scrollHeight - clientHeight);

  if (!speed || nextScrollTop === scrollTop) {
    autoScroll.frame = undefined;

    return;
  }

  container.scrollTop = nextScrollTop;
  autoScroll.frame = requestAnimationFrame(stepAutoScroll);
};

/**
 * Track the pointer during a drag to keep the auto-scroll speed up to date.
 * @param {DragEvent} event `dragover` event.
 */
const onAutoScrollDragOver = (event) => {
  // This listener is attached for exactly as long as the state exists, so it is always set here
  const state = /** @type {NonNullable<typeof autoScroll>} */ (autoScroll);

  state.speed = getAutoScrollSpeed({
    clientY: event.clientY,
    rect: state.container.getBoundingClientRect(),
  });

  if (state.speed && state.frame === undefined) {
    state.frame = requestAnimationFrame(stepAutoScroll);
  }
};

/**
 * Start scrolling the list’s scroll container whenever the pointer is dragged near its top or
 * bottom edge, so that an item can be moved beyond the visible part of a long list. Call this from
 * `dragstart`, and {@link stopAutoScroll} from both `drop` and `dragend`.
 *
 * The pointer is tracked on the window rather than on the list, for two reasons: the list’s own
 * `dragover` handler stops the event in the capture phase, and the hot zone reaches past the ends
 * of the list, where no `dragover` of ours would fire at all. A capture-phase listener sees the
 * event before anything can stop it.
 * @param {HTMLElement | undefined} listElement Element whose direct children are the list items.
 */
export const startAutoScroll = (listElement) => {
  const container = listElement ? getScrollContainer(listElement) : undefined;

  if (!container) {
    return;
  }

  autoScroll = { container, speed: 0, frame: undefined };
  globalThis.addEventListener('dragover', onAutoScrollDragOver, true);
};

/**
 * Stop the auto-scroll started by {@link startAutoScroll}.
 */
export const stopAutoScroll = () => {
  if (!autoScroll) {
    return;
  }

  globalThis.removeEventListener('dragover', onAutoScrollDragOver, true);
  // A frame may already be queued; dropping the state is enough to make it park the loop
  autoScroll = undefined;
};
