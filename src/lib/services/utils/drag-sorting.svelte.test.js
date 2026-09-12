// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

import { createDragSorter } from './drag-sorting.svelte.js';
import { createRawState } from './state.svelte.js';

vi.mock('$lib/services/utils/drag-sorting', async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  startAutoScroll: vi.fn(),
  stopAutoScroll: vi.fn(),
}));

const { startAutoScroll, stopAutoScroll } = await import('$lib/services/utils/drag-sorting');

/**
 * Build a list of items, each 40 pixels tall, stacked from the top of the viewport.
 * @param {number} count Number of items.
 * @returns {{ listElement: HTMLElement, items: HTMLElement[] }} Elements.
 */
const createList = (count) => {
  const listElement = document.createElement('div');

  const items = [...Array(count).keys()].map((index) => {
    const item = document.createElement('div');

    /**
     * Report a fixed rectangle, since jsdom doesn’t lay anything out.
     * @returns {DOMRect} Rectangle.
     */
    item.getBoundingClientRect = () =>
      /** @type {DOMRect} */ ({ top: index * 40, height: 40, bottom: index * 40 + 40 });

    listElement.append(item);

    return item;
  });

  document.body.append(listElement);

  return { listElement, items };
};

/**
 * Build a fake drag event.
 * @param {object} args Arguments.
 * @param {EventTarget | null} [args.target] Element under the pointer.
 * @param {number} [args.clientY] Vertical pointer position.
 * @param {boolean} [args.withDataTransfer] Whether to attach a `dataTransfer` object.
 * @returns {DragEvent & { dataTransfer: any }} Event.
 */
const createEvent = ({ target = null, clientY = 0, withDataTransfer = true } = {}) =>
  /** @type {any} */ ({
    target,
    currentTarget: target,
    clientY,
    dataTransfer: withDataTransfer
      ? { effectAllowed: '', dropEffect: '', setData: vi.fn() }
      : undefined,
    stopPropagation: vi.fn(),
    preventDefault: vi.fn(),
  });

describe('createDragSorter()', () => {
  /** @type {ReturnType<typeof createList>} */
  let list;
  /** @type {{ current: number }} */
  let itemCount;
  /** @type {import('vitest').Mock} */
  let onMove;
  /** @type {import('./drag-sorting.svelte.js').DragSorter} */
  let sorter;

  beforeEach(() => {
    document.body.innerHTML = '';
    list = createList(3);
    // The count is reactive, as a component’s state would be
    itemCount = createRawState(list.items.length);
    onMove = vi.fn();
    sorter = createDragSorter({
      /**
       * Get the item count.
       * @returns {number} Count.
       */
      getItemCount: () => itemCount.current,
      /**
       * Get the list element.
       * @returns {HTMLElement} Element.
       */
      getListElement: () => list.listElement,
      onMove,
    });
  });

  test('starts with nothing grabbed or dragged, in identity order', () => {
    expect(sorter.grabbedIndex).toBeUndefined();
    expect(sorter.dragIndex).toBeUndefined();
    expect(sorter.displayOrder).toEqual([0, 1, 2]);
  });

  test('tracks the grabbed item', () => {
    sorter.grab(1);
    expect(sorter.grabbedIndex).toBe(1);

    sorter.release();
    expect(sorter.grabbedIndex).toBeUndefined();
  });

  test('starts a drag with auto-scroll and drag data', () => {
    const event = createEvent();

    sorter.onDragStart(1, event, 'item 1');

    expect(sorter.dragIndex).toBe(1);
    expect(sorter.displayOrder).toEqual([0, 1, 2]);
    expect(startAutoScroll).toHaveBeenCalledWith(list.listElement);
    expect(event.dataTransfer.effectAllowed).toBe('move');
    expect(event.dataTransfer.setData).toHaveBeenCalledWith('text/plain', 'item 1');
  });

  test('starts a drag without an event', () => {
    sorter.onDragStart(1);

    expect(sorter.dragIndex).toBe(1);
    expect(startAutoScroll).toHaveBeenCalledWith(list.listElement);
  });

  test('attaches empty data when none is given', () => {
    const event = createEvent();

    sorter.onDragStart(1, event);

    expect(event.dataTransfer.setData).toHaveBeenCalledWith('text/plain', '');
  });

  test('ignores an event without `dataTransfer`', () => {
    expect(() => sorter.onDragStart(1, createEvent({ withDataTransfer: false }))).not.toThrow();
  });

  test('passes `dragover` through while nothing is being dragged', () => {
    const event = createEvent({ target: list.items[0] });

    sorter.onDragOver(event);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(event.stopPropagation).not.toHaveBeenCalled();
    expect(sorter.displayOrder).toEqual([0, 1, 2]);
  });

  test('previews the new order as the pointer moves over another item', () => {
    sorter.onDragStart(0);

    // Lower half of the last item
    const event = createEvent({ target: list.items[2], clientY: 110 });

    sorter.onDragOver(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(event.dataTransfer.dropEffect).toBe('move');
    expect(sorter.displayOrder).toEqual([1, 2, 0]);
    // The rendered order follows the preview; the sorter still refers to the original index
    expect(sorter.dragIndex).toBe(0);
    expect(onMove).not.toHaveBeenCalled();
  });

  test('keeps the preview while the pointer is over a gap between items', () => {
    sorter.onDragStart(0);
    sorter.onDragOver(createEvent({ target: list.items[2], clientY: 110 }));
    expect(sorter.displayOrder).toEqual([1, 2, 0]);

    const event = createEvent({ target: list.listElement, clientY: 50 });

    sorter.onDragOver(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(sorter.displayOrder).toEqual([1, 2, 0]);
  });

  test('keeps the preview while the pointer stays over the dragged item’s own slot', () => {
    sorter.onDragStart(1);

    // Upper half of the dragged item itself: no move
    sorter.onDragOver(createEvent({ target: list.items[1], clientY: 45 }));

    expect(sorter.displayOrder).toEqual([0, 1, 2]);
  });

  test('handles `dragover` without `dataTransfer`', () => {
    sorter.onDragStart(0);

    expect(() =>
      sorter.onDragOver(
        createEvent({ target: list.items[2], clientY: 110, withDataTransfer: false }),
      ),
    ).not.toThrow();
    expect(sorter.displayOrder).toEqual([1, 2, 0]);
  });

  test('commits the previewed order on drop', () => {
    sorter.grab(0);
    sorter.onDragStart(0);
    sorter.onDragOver(createEvent({ target: list.items[2], clientY: 110 }));

    const event = createEvent({ target: list.items[2] });

    sorter.onDrop(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(stopAutoScroll).toHaveBeenCalled();
    expect(onMove).toHaveBeenCalledWith(0, 2);
    expect(sorter.grabbedIndex).toBeUndefined();
    expect(sorter.dragIndex).toBeUndefined();
    expect(sorter.displayOrder).toEqual([0, 1, 2]);
  });

  test('doesn’t move anything when dropped where it started', () => {
    sorter.onDragStart(1);
    sorter.onDrop(createEvent({ target: list.items[1] }));

    expect(onMove).not.toHaveBeenCalled();
    expect(sorter.dragIndex).toBeUndefined();
  });

  test('passes `drop` through while nothing is being dragged', () => {
    const event = createEvent({ target: list.items[0] });

    sorter.onDrop(event);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(onMove).not.toHaveBeenCalled();
  });

  test('puts everything back when the drag is cancelled', () => {
    sorter.grab(0);
    sorter.onDragStart(0);
    sorter.onDragOver(createEvent({ target: list.items[2], clientY: 110 }));
    expect(sorter.displayOrder).toEqual([1, 2, 0]);

    sorter.onDragEnd();

    expect(stopAutoScroll).toHaveBeenCalled();
    expect(onMove).not.toHaveBeenCalled();
    expect(sorter.grabbedIndex).toBeUndefined();
    expect(sorter.dragIndex).toBeUndefined();
    expect(sorter.displayOrder).toEqual([0, 1, 2]);
  });

  test('discards a stale preview once the list changes length', () => {
    sorter.onDragStart(0);
    sorter.onDragOver(createEvent({ target: list.items[2], clientY: 110 }));
    expect(sorter.displayOrder).toEqual([1, 2, 0]);

    list.listElement.append(document.createElement('div'));
    itemCount.current = 4;

    expect(sorter.displayOrder).toEqual([0, 1, 2, 3]);
  });
});
