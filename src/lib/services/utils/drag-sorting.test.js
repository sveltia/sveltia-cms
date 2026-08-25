// @vitest-environment jsdom

import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  getAutoScrollSpeed,
  getDropIndex,
  getKeyboardMoveTarget,
  getListItemAt,
  getMoveTarget,
  getScrollContainer,
  moveListItem,
  startAutoScroll,
  stopAutoScroll,
} from '$lib/services/utils/drag-sorting';

/**
 * Create a fake bounding rectangle for an item spanning the given vertical range.
 * @param {number} top Top edge.
 * @param {number} height Height.
 * @returns {DOMRect} Rectangle.
 */
const rect = (top, height) => /** @type {DOMRect} */ ({ top, height });

describe('getDropIndex', () => {
  test('returns the item’s own index in the upper half', () => {
    expect(getDropIndex({ index: 2, clientY: 100, rect: rect(100, 40) })).toBe(2);
    expect(getDropIndex({ index: 2, clientY: 119, rect: rect(100, 40) })).toBe(2);
  });

  test('returns the next index in the lower half', () => {
    expect(getDropIndex({ index: 2, clientY: 120, rect: rect(100, 40) })).toBe(3);
    expect(getDropIndex({ index: 2, clientY: 140, rect: rect(100, 40) })).toBe(3);
  });
});

describe('moveListItem', () => {
  test('moves an item down', () => {
    expect(moveListItem([0, 1, 2, 3], 0, 2)).toEqual([1, 2, 0, 3]);
  });

  test('moves an item up', () => {
    expect(moveListItem([0, 1, 2, 3], 3, 1)).toEqual([0, 3, 1, 2]);
  });

  test('leaves the original list alone', () => {
    const list = [0, 1, 2];

    expect(moveListItem(list, 0, 2)).not.toBe(list);
    expect(list).toEqual([0, 1, 2]);
  });

  test('is a no-op when the source and destination are the same', () => {
    expect(moveListItem([0, 1, 2], 1, 1)).toEqual([0, 1, 2]);
  });
});

describe('getMoveTarget', () => {
  test('moves an item down, accounting for its own removal', () => {
    expect(getMoveTarget({ dragIndex: 1, dropIndex: 4 })).toBe(3);
  });

  test('moves an item up', () => {
    expect(getMoveTarget({ dragIndex: 4, dropIndex: 1 })).toBe(1);
  });

  test('ignores a drop at either gap adjacent to the dragged item', () => {
    expect(getMoveTarget({ dragIndex: 2, dropIndex: 2 })).toBeUndefined();
    expect(getMoveTarget({ dragIndex: 2, dropIndex: 3 })).toBeUndefined();
  });

  test('ignores an incomplete drag', () => {
    expect(getMoveTarget({ dragIndex: undefined, dropIndex: 2 })).toBeUndefined();
    expect(getMoveTarget({ dragIndex: 2, dropIndex: undefined })).toBeUndefined();
  });
});

describe('getKeyboardMoveTarget', () => {
  test('moves an item by one with the arrow keys', () => {
    expect(getKeyboardMoveTarget({ key: 'ArrowUp', index: 2, itemCount: 5 })).toBe(1);
    expect(getKeyboardMoveTarget({ key: 'ArrowDown', index: 2, itemCount: 5 })).toBe(3);
  });

  test('sends an item to either end with Home and End', () => {
    expect(getKeyboardMoveTarget({ key: 'Home', index: 3, itemCount: 5 })).toBe(0);
    expect(getKeyboardMoveTarget({ key: 'End', index: 1, itemCount: 5 })).toBe(4);
  });

  test('ignores a key that would move an item past either end', () => {
    expect(getKeyboardMoveTarget({ key: 'ArrowUp', index: 0, itemCount: 5 })).toBeUndefined();
    expect(getKeyboardMoveTarget({ key: 'Home', index: 0, itemCount: 5 })).toBeUndefined();
    expect(getKeyboardMoveTarget({ key: 'ArrowDown', index: 4, itemCount: 5 })).toBeUndefined();
    expect(getKeyboardMoveTarget({ key: 'End', index: 4, itemCount: 5 })).toBeUndefined();
  });

  test('ignores any other key', () => {
    expect(getKeyboardMoveTarget({ key: 'Enter', index: 2, itemCount: 5 })).toBeUndefined();
    expect(getKeyboardMoveTarget({ key: 'ArrowLeft', index: 2, itemCount: 5 })).toBeUndefined();
  });
});

describe('getListItemAt', () => {
  /**
   * Build a list of three items, the last of which contains a nested list of its own.
   * @returns {{ listElement: HTMLElement, items: HTMLElement[], nestedItem: HTMLElement }}
   * Elements.
   */
  const createList = () => {
    const listElement = document.createElement('div');

    const items = [0, 1, 2].map(() => {
      const item = document.createElement('div');

      listElement.append(item);

      return item;
    });

    const nestedList = document.createElement('div');
    const nestedItem = document.createElement('div');

    nestedList.append(nestedItem);
    items[2].append(nestedList);
    document.body.append(listElement);

    return { listElement, items, nestedItem };
  };

  test('resolves an item element to its own index', () => {
    const { listElement, items } = createList();

    expect(getListItemAt({ target: items[1], listElement })).toEqual({
      element: items[1],
      index: 1,
    });
  });

  test('resolves a descendant to the item that contains it', () => {
    const { listElement, items } = createList();
    const child = document.createElement('span');

    items[0].append(child);

    expect(getListItemAt({ target: child, listElement })).toEqual({ element: items[0], index: 0 });
  });

  test('resolves an item of a nested list to the outer item containing it', () => {
    const { listElement, items, nestedItem } = createList();

    expect(getListItemAt({ target: nestedItem, listElement })).toEqual({
      element: items[2],
      index: 2,
    });
  });

  test('returns nothing for the list element itself', () => {
    const { listElement } = createList();

    expect(getListItemAt({ target: listElement, listElement })).toBeUndefined();
  });

  test('returns nothing for a target outside the list', () => {
    const { listElement } = createList();
    const outside = document.createElement('div');

    document.body.append(outside);

    expect(getListItemAt({ target: outside, listElement })).toBeUndefined();
  });

  test('returns nothing without a list element or an element target', () => {
    const { listElement, items } = createList();

    expect(getListItemAt({ target: items[0], listElement: undefined })).toBeUndefined();
    expect(getListItemAt({ target: null, listElement })).toBeUndefined();
  });
});

describe('getScrollContainer', () => {
  /**
   * Build an element nested inside an ancestor with the given styles and scroll extent.
   * @param {object} args Arguments.
   * @param {string} args.overflowY `overflow-y` of the ancestor.
   * @param {number} args.scrollHeight Scroll height of the ancestor.
   * @param {number} args.clientHeight Client height of the ancestor.
   * @returns {{ ancestor: HTMLElement, element: HTMLElement }} Elements.
   */
  const createNested = ({ overflowY, scrollHeight, clientHeight }) => {
    const ancestor = document.createElement('div');
    const element = document.createElement('div');

    ancestor.style.overflowY = overflowY;
    Object.defineProperty(ancestor, 'scrollHeight', { value: scrollHeight, configurable: true });
    Object.defineProperty(ancestor, 'clientHeight', { value: clientHeight, configurable: true });
    ancestor.append(element);
    document.body.append(ancestor);

    return { ancestor, element };
  };

  test('finds a scrollable ancestor', () => {
    const { ancestor, element } = createNested({
      overflowY: 'auto',
      scrollHeight: 900,
      clientHeight: 300,
    });

    expect(getScrollContainer(element)).toBe(ancestor);
  });

  test('finds an ancestor with an always-on scrollbar', () => {
    const { ancestor, element } = createNested({
      overflowY: 'scroll',
      scrollHeight: 900,
      clientHeight: 300,
    });

    expect(getScrollContainer(element)).toBe(ancestor);
  });

  test('ignores an ancestor that doesn’t scroll', () => {
    const { element } = createNested({
      overflowY: 'visible',
      scrollHeight: 900,
      clientHeight: 300,
    });

    expect(getScrollContainer(element)).toBeUndefined();
  });

  test('ignores a scrollable ancestor with nothing to scroll', () => {
    const { element } = createNested({ overflowY: 'auto', scrollHeight: 300, clientHeight: 300 });

    expect(getScrollContainer(element)).toBeUndefined();
  });

  test('returns nothing for a detached element', () => {
    expect(getScrollContainer(document.createElement('div'))).toBeUndefined();
  });
});

describe('getAutoScrollSpeed', () => {
  const containerRect = /** @type {DOMRect} */ ({ top: 100, bottom: 500 });

  test('doesn’t scroll away from either edge', () => {
    expect(getAutoScrollSpeed({ clientY: 300, rect: containerRect })).toBe(0);
    expect(getAutoScrollSpeed({ clientY: 164, rect: containerRect })).toBe(0);
    expect(getAutoScrollSpeed({ clientY: 436, rect: containerRect })).toBe(0);
  });

  test('scrolls up near the top edge, faster the closer it gets', () => {
    const nearZoneEdge = getAutoScrollSpeed({ clientY: 160, rect: containerRect });
    const atContainerEdge = getAutoScrollSpeed({ clientY: 100, rect: containerRect });

    expect(nearZoneEdge).toBeLessThan(0);
    expect(atContainerEdge).toBe(-16);
    expect(atContainerEdge).toBeLessThan(nearZoneEdge);
  });

  test('scrolls down near the bottom edge, faster the closer it gets', () => {
    const nearZoneEdge = getAutoScrollSpeed({ clientY: 440, rect: containerRect });
    const atContainerEdge = getAutoScrollSpeed({ clientY: 500, rect: containerRect });

    expect(nearZoneEdge).toBeGreaterThan(0);
    expect(atContainerEdge).toBe(16);
    expect(atContainerEdge).toBeGreaterThan(nearZoneEdge);
  });

  test('caps the speed for a pointer dragged past either edge', () => {
    expect(getAutoScrollSpeed({ clientY: -200, rect: containerRect })).toBe(-16);
    expect(getAutoScrollSpeed({ clientY: 900, rect: containerRect })).toBe(16);
  });
});

describe('startAutoScroll', () => {
  /** @type {{ id: number, fn: () => void }[]} */
  let frames = [];
  let nextFrameId = 0;

  /**
   * Build a scrollable container holding a list element, with the animation frames captured so the
   * loop can be stepped by hand.
   * @returns {{ container: HTMLElement, list: HTMLElement }} Elements.
   */
  const createScrollable = () => {
    const container = document.createElement('div');
    const list = document.createElement('div');

    container.style.overflowY = 'auto';
    Object.defineProperty(container, 'scrollHeight', { value: 1000, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 400, configurable: true });
    // jsdom doesn’t implement scrolling, so back `scrollTop` with a plain property
    Object.defineProperty(container, 'scrollTop', { value: 0, writable: true, configurable: true });
    /**
     * Report a fixed rectangle, since jsdom doesn’t lay anything out.
     * @returns {DOMRect} Rectangle.
     */
    container.getBoundingClientRect = () =>
      /** @type {DOMRect} */ ({ top: 0, bottom: 400, height: 400 });
    container.append(list);
    document.body.append(container);

    frames = [];

    vi.stubGlobal('requestAnimationFrame', (/** @type {() => void} */ fn) => {
      nextFrameId += 1;
      frames.push({ id: nextFrameId, fn });

      return nextFrameId;
    });

    return { container, list };
  };

  /**
   * Dispatch a `dragover` event at the given pointer position.
   * @param {number} clientY Vertical pointer position.
   */
  const dragOver = (clientY) => {
    globalThis.dispatchEvent(new MouseEvent('dragover', { clientY }));
  };

  /**
   * Run the frames queued so far.
   */
  const runFrames = () => {
    const queued = frames;

    frames = [];
    queued.forEach(({ fn }) => fn());
  };

  afterEach(() => {
    stopAutoScroll();
    vi.unstubAllGlobals();
  });

  test('scrolls down while the pointer is near the bottom edge', () => {
    const { container, list } = createScrollable();

    startAutoScroll(list);
    dragOver(400);
    runFrames();

    expect(container.scrollTop).toBe(16);

    runFrames();
    expect(container.scrollTop).toBe(32);
  });

  test('scrolls up while the pointer is near the top edge', () => {
    const { container, list } = createScrollable();

    container.scrollTop = 100;
    startAutoScroll(list);
    dragOver(0);
    runFrames();

    expect(container.scrollTop).toBe(84);
  });

  test('doesn’t scroll while the pointer is away from both edges', () => {
    const { container, list } = createScrollable();

    startAutoScroll(list);
    dragOver(200);

    expect(frames).toHaveLength(0);
    expect(container.scrollTop).toBe(0);
  });

  test('parks the loop once the pointer leaves the hot zone', () => {
    const { container, list } = createScrollable();

    startAutoScroll(list);
    dragOver(400);
    runFrames();
    expect(container.scrollTop).toBe(16);

    dragOver(200);
    runFrames();
    expect(container.scrollTop).toBe(16);

    // …and picks it up again when the pointer comes back
    dragOver(400);
    runFrames();
    expect(container.scrollTop).toBe(32);
  });

  test('stops at the end of the scroll range', () => {
    const { container, list } = createScrollable();

    container.scrollTop = 595;
    startAutoScroll(list);
    dragOver(400);
    runFrames();

    expect(container.scrollTop).toBe(600);

    runFrames();
    expect(container.scrollTop).toBe(600);
    expect(frames).toHaveLength(0);
  });

  test('ignores a list with no scrollable ancestor', () => {
    const list = document.createElement('div');

    document.body.append(list);
    startAutoScroll(list);
    dragOver(400);

    expect(frames).toHaveLength(0);
  });

  test('ignores a missing list element', () => {
    createScrollable();
    startAutoScroll(undefined);
    dragOver(400);

    expect(frames).toHaveLength(0);
  });

  test('stops tracking the pointer once the drag is over', () => {
    const { container, list } = createScrollable();

    startAutoScroll(list);
    dragOver(400);
    runFrames();
    expect(container.scrollTop).toBe(16);

    stopAutoScroll();
    frames = [];
    dragOver(400);

    expect(frames).toHaveLength(0);
    expect(container.scrollTop).toBe(16);
  });

  test('parks a frame that was already queued when the drag ended', () => {
    const { container, list } = createScrollable();

    startAutoScroll(list);
    dragOver(400);
    // The frame queued here outlives the drag, so it must find nothing left to scroll
    stopAutoScroll();
    runFrames();

    expect(container.scrollTop).toBe(0);
    expect(frames).toHaveLength(0);
  });

  test('is safe to stop when no drag is in progress', () => {
    createScrollable();

    expect(() => stopAutoScroll()).not.toThrow();
  });
});
