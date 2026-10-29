// @vitest-environment happy-dom

import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  findFieldElement,
  findLazyFieldElement,
  getFieldAlignedScrollTop,
  getProportionalScrollTop,
  getRevealingScrollTop,
  getStickyToolbarBottom,
  scrollToAddedListItem,
} from '$lib/services/contents/editor/scroll';

/**
 * Render the given HTML in a container.
 * @param {string} html HTML.
 * @returns {HTMLElement} Container.
 */
const render = (html) => {
  const container = document.createElement('div');

  container.innerHTML = html;
  document.body.append(container);

  return container;
};

describe('getProportionalScrollTop()', () => {
  test('scrolls the other pane in proportion to its own scrollable range', () => {
    const panes = { scrollHeight: 1500, clientHeight: 500, targetScrollHeight: 2000 };

    expect(getProportionalScrollTop({ ...panes, scrollTop: 250, targetClientHeight: 400 })).toBe(
      400,
    );
    expect(getProportionalScrollTop({ ...panes, scrollTop: 0, targetClientHeight: 400 })).toBe(0);
    // Scrolled to the bottom, the other pane is scrolled to its bottom, not past it
    expect(getProportionalScrollTop({ ...panes, scrollTop: 1000, targetClientHeight: 400 })).toBe(
      1600,
    );
  });

  test('stays at the top when either pane can’t scroll', () => {
    expect(
      getProportionalScrollTop({
        scrollTop: 0,
        scrollHeight: 500,
        clientHeight: 500,
        targetScrollHeight: 2000,
        targetClientHeight: 400,
      }),
    ).toBe(0);
    expect(
      getProportionalScrollTop({
        scrollTop: 250,
        scrollHeight: 1500,
        clientHeight: 500,
        targetScrollHeight: 300,
        targetClientHeight: 400,
      }),
    ).toBe(0);
  });
});

describe('getFieldAlignedScrollTop()', () => {
  test('aligns the matching field at the same relative position', () => {
    // The top of the content area is a quarter of the way through the field, so the other pane is
    // scrolled a quarter of the way through the matching field, wherever the panes are on the
    // screen
    expect(
      getFieldAlignedScrollTop({
        y: 100,
        top: 50,
        height: 200,
        targetTop: 600,
        targetHeight: 400,
      }),
    ).toBe(700);
    expect(
      getFieldAlignedScrollTop({
        y: 100,
        top: 100,
        height: 200,
        targetTop: 600,
        targetHeight: 400,
      }),
    ).toBe(600);
    expect(
      getFieldAlignedScrollTop({
        y: 100,
        top: -100,
        height: 200,
        targetTop: 600,
        targetHeight: 400,
      }),
    ).toBe(1000);
  });

  test('gives up when the top of the content area is outside the field', () => {
    expect(
      getFieldAlignedScrollTop({
        y: 100,
        top: 150,
        height: 200,
        targetTop: 600,
        targetHeight: 400,
      }),
    ).toBeUndefined();
    expect(
      getFieldAlignedScrollTop({
        y: 100,
        top: -150,
        height: 200,
        targetTop: 600,
        targetHeight: 400,
      }),
    ).toBeUndefined();
  });
});

describe('findFieldElement()', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  test('finds the element showing the field', () => {
    const container = render(
      '<section data-key-path="items"><p data-key-path="items.0.title">A</p></section>',
    );

    expect(findFieldElement(container, 'items.0.title')?.textContent).toBe('A');
  });

  test('falls back to the element showing the nearest parent', () => {
    const container = render('<section data-key-path="items"><p>A</p></section>');

    expect(findFieldElement(container, 'items.0.title')?.dataset.keyPath).toBe('items');
  });

  test('skips an element that isn’t rendered', () => {
    const container = render(
      '<section data-key-path="items"><p data-key-path="items.0" hidden>A</p></section>',
    );

    // happy-dom doesn’t lay out the document, so it gives a hidden element a box too
    vi.spyOn(
      /** @type {HTMLElement} */ (container.querySelector('p')),
      'getClientRects',
    ).mockReturnValue(/** @type {DOMRectList} */ (/** @type {unknown} */ ([])));

    expect(findFieldElement(container, 'items.0')?.dataset.keyPath).toBe('items');
  });

  test('gives up when no element shows the field or a parent', () => {
    const container = render('<p data-key-path="other">A</p>');

    expect(findFieldElement(container, 'items.0')).toBeUndefined();
  });

  test('prefers the field’s own element to the wrapper of the same key path', () => {
    const container = render(
      '<div data-lazy-key-path="title"><p data-key-path="title">A</p></div>',
    );

    expect(findFieldElement(container, 'title')?.textContent).toBe('A');
  });

  test('falls back to the wrapper of a field not rendered yet', () => {
    const container = render(
      [
        '<div data-lazy-key-path="title"><p data-key-path="title">A</p></div>',
        '<div data-lazy-key-path="body"><div class="placeholder"></div></div>',
      ].join(''),
    );

    expect(findFieldElement(container, 'body')?.dataset.lazyKeyPath).toBe('body');
  });

  test('falls back to the wrapper of a List item before the whole list', () => {
    const container = render(
      [
        '<section data-key-path="items">',
        '<div data-lazy-key-path="items.1"><div class="placeholder"></div></div>',
        '</section>',
      ].join(''),
    );

    expect(findFieldElement(container, 'items.1.title')?.dataset.lazyKeyPath).toBe('items.1');
    expect(findFieldElement(container, 'items.2.title')?.dataset.keyPath).toBe('items');
  });

  test('prefers the innermost wrapper of the same key path', () => {
    const container = render(
      [
        '<div data-lazy-key-path="items.1" id="item">',
        '<div data-lazy-key-path="items.1" id="field"><div class="placeholder"></div></div>',
        '</div>',
      ].join(''),
    );

    expect(findFieldElement(container, 'items.1')?.id).toBe('field');
  });

  test('skips the wrapper of a field that isn’t shown in the preview', () => {
    const container = render(
      [
        '<section data-key-path="author">',
        '<div data-lazy-key-path="author.name"><!----></div>',
        '</section>',
        '<div data-lazy-key-path="hidden"><!----></div>',
      ].join(''),
    );

    expect(findFieldElement(container, 'author.name')?.dataset.keyPath).toBe('author');
    expect(findFieldElement(container, 'hidden')).toBeUndefined();
  });

  test('skips the wrapper of a field rendered but hidden', () => {
    const container = render(
      [
        '<section data-key-path="author">',
        '<div data-lazy-key-path="author.name"><p data-key-path="author.name" hidden>A</p></div>',
        '</section>',
      ].join(''),
    );

    vi.spyOn(
      /** @type {HTMLElement} */ (container.querySelector('p')),
      'getClientRects',
    ).mockReturnValue(/** @type {DOMRectList} */ (/** @type {unknown} */ ([])));

    expect(findFieldElement(container, 'author.name')?.dataset.keyPath).toBe('author');
  });

  test('skips a wrapper that isn’t rendered', () => {
    const container = render(
      [
        '<section data-key-path="author">',
        '<div data-lazy-key-path="author.name" hidden><div class="placeholder"></div></div>',
        '</section>',
      ].join(''),
    );

    vi.spyOn(
      /** @type {HTMLElement} */ (container.querySelector('[data-lazy-key-path]')),
      'getClientRects',
    ).mockReturnValue(/** @type {DOMRectList} */ (/** @type {unknown} */ ([])));

    expect(findFieldElement(container, 'author.name')?.dataset.keyPath).toBe('author');
  });
});

describe('findLazyFieldElement()', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  /**
   * Render a list of three items, of which only the first is rendered, like the default preview,
   * after a top-level field not rendered yet.
   * @returns {HTMLElement} Container.
   */
  const renderList = () =>
    render(
      [
        '<div data-lazy-key-path="body"><div class="placeholder"></div></div>',
        '<div data-lazy-key-path="items"><section data-key-path="items">',
        '<div data-lazy-key-path="items.0">',
        '<div data-lazy-key-path="items.0.title"><p data-key-path="items.0.title">A</p></div>',
        '</div>',
        '<div data-lazy-key-path="items.1"><div class="placeholder"></div></div>',
        '<div data-lazy-key-path="items.2"><div class="placeholder"></div></div>',
        '</section></div>',
      ].join(''),
    );

  /**
   * Render the content of the given wrapper, like the preview does once it’s scrolled into view.
   * @param {HTMLElement} container Container.
   * @param {string} keyPath Key path of the wrapper.
   * @param {string} html Content.
   */
  const renderWrapper = (container, keyPath, html) => {
    /** @type {HTMLElement} */ (
      container.querySelector(`[data-lazy-key-path="${keyPath}"]`)
    ).innerHTML = html;
  };

  test('finds a rendered field without scrolling', async () => {
    const container = renderList();
    const scrollTo = vi.fn(() => true);

    const element = await findLazyFieldElement({
      container,
      keyPath: 'items.0.title',
      scrollTo,
      interval: 0,
    });

    expect(element?.textContent).toBe('A');
    expect(scrollTo).not.toHaveBeenCalled();
  });

  test('gives up when no element shows the field or a parent', async () => {
    const container = renderList();
    const scrollTo = vi.fn(() => true);

    expect(
      await findLazyFieldElement({ container, keyPath: 'other', scrollTo, interval: 0 }),
    ).toBeUndefined();
    expect(scrollTo).not.toHaveBeenCalled();
  });

  test('settles for a rendered parent without scrolling', async () => {
    const container = renderList();
    const scrollTo = vi.fn(() => true);

    const element = await findLazyFieldElement({
      container,
      keyPath: 'items.3.title',
      scrollTo,
      interval: 0,
    });

    expect(element?.dataset.keyPath).toBe('items');
    expect(scrollTo).not.toHaveBeenCalled();
  });

  test('scrolls to a top-level field until it’s rendered', async () => {
    const container = renderList();

    const scrollTo = vi.fn((/** @type {HTMLElement} */ _target) => {
      renderWrapper(container, 'body', '<p data-key-path="body">Body</p>');

      return true;
    });

    const element = await findLazyFieldElement({
      container,
      keyPath: 'body',
      scrollTo,
      interval: 0,
    });

    expect(element?.textContent).toBe('Body');
    expect(scrollTo).toHaveBeenCalledOnce();
    expect(scrollTo.mock.calls[0][0].dataset.lazyKeyPath).toBe('body');
  });

  test('scrolls to the List item, then to its subfield, until the field is rendered', async () => {
    const container = renderList();

    const scrollTo = vi.fn((/** @type {HTMLElement} */ target) => {
      // The item renders the wrappers of its subfields, which render the subfields in turn
      if (target.dataset.lazyKeyPath === 'items.2') {
        renderWrapper(
          container,
          'items.2',
          [
            '<div data-lazy-key-path="items.2.title"><p data-key-path="items.2.title">C</p></div>',
            '<div data-lazy-key-path="items.2.body"><div class="placeholder"></div></div>',
          ].join(''),
        );
      } else {
        renderWrapper(container, 'items.2.body', '<p data-key-path="items.2.body">Body</p>');
      }

      return true;
    });

    const element = await findLazyFieldElement({
      container,
      keyPath: 'items.2.body',
      scrollTo,
      interval: 0,
    });

    expect(element?.textContent).toBe('Body');
    expect(scrollTo.mock.calls.map(([target]) => target.dataset.lazyKeyPath)).toEqual([
      'items.2',
      'items.2.body',
    ]);
  });

  test('settles for the wrapper once the pane can’t get any closer', async () => {
    const container = renderList();
    const scrollTo = vi.fn(() => scrollTo.mock.calls.length === 1);

    const element = await findLazyFieldElement({
      container,
      keyPath: 'items.2.title',
      scrollTo,
      interval: 0,
    });

    expect(element?.dataset.lazyKeyPath).toBe('items.2');
    expect(scrollTo).toHaveBeenCalledTimes(2);
  });

  test('keeps going while the wrapper changes, even without scrolling', async () => {
    const container = renderList();

    const scrollTo = vi.fn(() => {
      if (scrollTo.mock.calls.length === 1) {
        renderWrapper(
          container,
          'items.2',
          '<div data-lazy-key-path="items.2.title"><div class="placeholder"></div></div>',
        );
      } else {
        renderWrapper(container, 'items.2.title', '<p data-key-path="items.2.title">C</p>');
      }

      return false;
    });

    const element = await findLazyFieldElement({
      container,
      keyPath: 'items.2.title',
      scrollTo,
      interval: 0,
    });

    expect(element?.textContent).toBe('C');
  });

  test('abandons an outdated request', async () => {
    const container = renderList();
    const scrollTo = vi.fn(() => true);

    expect(
      await findLazyFieldElement({
        container,
        keyPath: 'items.2.title',
        scrollTo,
        isOutdated: vi.fn(() => true),
        interval: 0,
      }),
    ).toBeUndefined();
    expect(scrollTo).toHaveBeenCalledOnce();
  });

  test('gives up after the given number of attempts', async () => {
    const container = renderList();
    const scrollTo = vi.fn(() => true);

    const element = await findLazyFieldElement({
      container,
      keyPath: 'items.2.title',
      scrollTo,
      maxAttempts: 3,
      interval: 0,
    });

    expect(element?.dataset.lazyKeyPath).toBe('items.2');
    expect(scrollTo).toHaveBeenCalledTimes(3);
  });

  test('uses the default options', async () => {
    const container = renderList();

    renderWrapper(container, 'items.2', '<p data-key-path="items.2.title">C</p>');

    expect(
      (
        await findLazyFieldElement({
          container,
          keyPath: 'items.2.title',
          scrollTo: vi.fn(() => true),
        })
      )?.textContent,
    ).toBe('C');
  });
});

describe('getRevealingScrollTop()', () => {
  const view = { viewTop: 100, viewHeight: 500, scrollTop: 1000 };

  test('leaves an entirely visible element alone', () => {
    expect(getRevealingScrollTop({ ...view, top: 100, height: 500 })).toBeUndefined();
    expect(getRevealingScrollTop({ ...view, top: 300, height: 100 })).toBeUndefined();
  });

  test('centers an element below or above the visible area', () => {
    expect(getRevealingScrollTop({ ...view, top: 900, height: 100 })).toBe(1600);
    expect(getRevealingScrollTop({ ...view, top: -300, height: 100 })).toBe(400);
  });

  test('centers a partly visible element', () => {
    expect(getRevealingScrollTop({ ...view, top: 550, height: 100 })).toBe(1250);
  });

  test('doesn’t scroll past the top', () => {
    expect(getRevealingScrollTop({ ...view, top: -900, height: 100 })).toBe(0);
    expect(getRevealingScrollTop({ ...view, top: -1900, height: 1000 })).toBe(0);
  });

  test('leaves a partly visible element taller than the pane alone', () => {
    expect(getRevealingScrollTop({ ...view, top: -200, height: 1000 })).toBeUndefined();
    expect(getRevealingScrollTop({ ...view, top: 500, height: 1000 })).toBeUndefined();
  });

  test('gets the position of a visible element when asked to', () => {
    expect(getRevealingScrollTop({ ...view, top: 300, height: 100, always: true })).toBe(1000);
    expect(getRevealingScrollTop({ ...view, top: -200, height: 1000, always: true })).toBe(700);
  });

  test('aligns an element taller than the pane to the top', () => {
    expect(getRevealingScrollTop({ ...view, top: 600, height: 1000 })).toBe(1500);
    expect(getRevealingScrollTop({ ...view, top: -1000, height: 1000 })).toBe(0);
    expect(getRevealingScrollTop({ ...view, top: -800, height: 600 })).toBe(100);
  });
});

describe('getStickyToolbarBottom()', () => {
  test('is 0 without a toolbar', () => {
    expect(getStickyToolbarBottom(undefined)).toBe(0);
  });

  test('adds the height of the toolbar to the offset it sticks at', () => {
    const toolbar = document.createElement('div');

    toolbar.style.top = '48px';
    vi.spyOn(toolbar, 'getBoundingClientRect').mockReturnValue(
      /** @type {DOMRect} */ ({ height: 36 }),
    );
    document.body.append(toolbar);

    expect(getStickyToolbarBottom(toolbar)).toBe(84);
  });
});

describe('scrollToAddedListItem()', () => {
  /**
   * Create a list item, whose offset in the list is read twice per scroll: right after it, and once
   * the fields that came into view have rendered.
   * @param {object} args Arguments.
   * @param {(read: number) => number} args.getOffset Function returning the offset of the item for
   * the given read, counted from 1.
   * @param {number} [args.headerBottom] Bottom of the item’s header in the viewport.
   * @returns {{ item: HTMLElement, list: HTMLElement }} Item and list.
   */
  const createItem = ({ getOffset, headerBottom = 5040 }) => {
    const list = render('<div class="item"><div class="header"></div></div>');
    const item = /** @type {HTMLElement} */ (list.firstElementChild);
    let read = 0;

    item.scrollIntoView = vi.fn();
    item.getBoundingClientRect = vi.fn(() => {
      read += 1;

      return /** @type {DOMRect} */ ({ top: getOffset(read) });
    });
    list.getBoundingClientRect = vi.fn(() => /** @type {DOMRect} */ ({ top: 0 }));
    /** @type {HTMLElement} */ (item.firstElementChild).getBoundingClientRect = vi.fn(
      () => /** @type {DOMRect} */ ({ bottom: headerBottom }),
    );

    return { item, list };
  };

  /**
   * Get the offset of an item staying in place.
   * @returns {number} Offset.
   */
  const inPlace = () => 100;
  /**
   * Get the offset of an item pushed far down after every scroll.
   * @param {number} read Read count.
   * @returns {number} Offset.
   */
  const pushedDown = (read) => (read % 2 === 0 ? 5000 : 0);
  /**
   * Get the offset of an item pushed far down after the first two scrolls only.
   * @param {number} read Read count.
   * @returns {number} Offset.
   */
  const pushedDownTwice = (read) => (read <= 4 ? pushedDown(read) : 0);
  /**
   * Tell that another item has been added since.
   * @returns {boolean} Result.
   */
  const outdated = () => true;

  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('scrolls to the item once if it stays in place', async () => {
    const { item, list } = createItem({ getOffset: inPlace });

    await scrollToAddedListItem({ item, list, interval: 0 });

    expect(item.scrollIntoView).toHaveBeenCalledTimes(1);
  });

  test('follows the item while the items above push it out of view', async () => {
    const { item, list } = createItem({ getOffset: pushedDownTwice });

    await scrollToAddedListItem({ item, list, interval: 0 });

    expect(item.scrollIntoView).toHaveBeenCalledTimes(3);
  });

  test('stops following the item if its header stays in view', async () => {
    const { item, list } = createItem({ getOffset: pushedDown, headerBottom: 90 });

    await scrollToAddedListItem({ item, list, interval: 0 });

    expect(item.scrollIntoView).toHaveBeenCalledTimes(1);
  });

  test('stops following the item once another one is added', async () => {
    const { item, list } = createItem({ getOffset: pushedDown });

    await scrollToAddedListItem({ item, list, isOutdated: outdated, interval: 0 });

    expect(item.scrollIntoView).toHaveBeenCalledTimes(1);
  });

  test('gives up after the maximum number of attempts', async () => {
    const { item, list } = createItem({ getOffset: pushedDown });

    await scrollToAddedListItem({ item, list, maxAttempts: 3, interval: 0 });

    expect(item.scrollIntoView).toHaveBeenCalledTimes(3);
  });
});
