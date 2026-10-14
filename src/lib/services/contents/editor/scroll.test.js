// @vitest-environment happy-dom

import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  findFieldElement,
  findLazyFieldElement,
  getFieldAlignedScrollTop,
  getProportionalScrollTop,
  getRevealingScrollTop,
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
    // The top of the content area is a quarter of the way through the field
    expect(
      getFieldAlignedScrollTop({
        y: 100,
        top: 50,
        height: 200,
        targetOffsetTop: 600,
        targetHeight: 400,
      }),
    ).toBe(600);
    expect(
      getFieldAlignedScrollTop({
        y: 100,
        top: 100,
        height: 200,
        targetOffsetTop: 600,
        targetHeight: 400,
      }),
    ).toBe(500);
    expect(
      getFieldAlignedScrollTop({
        y: 100,
        top: -100,
        height: 200,
        targetOffsetTop: 600,
        targetHeight: 400,
      }),
    ).toBe(900);
  });

  test('gives up when the top of the content area is outside the field', () => {
    expect(
      getFieldAlignedScrollTop({
        y: 100,
        top: 150,
        height: 200,
        targetOffsetTop: 600,
        targetHeight: 400,
      }),
    ).toBeUndefined();
    expect(
      getFieldAlignedScrollTop({
        y: 100,
        top: -150,
        height: 200,
        targetOffsetTop: 600,
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

  test('prefers the field’s own element to the List item of the same key path', () => {
    const container = render(
      '<div data-list-item-key-path="items.1"><p data-key-path="items.1">B</p></div>',
    );

    expect(findFieldElement(container, 'items.1')?.textContent).toBe('B');
  });

  test('falls back to the List item before the whole list', () => {
    const container = render(
      '<section data-key-path="items"><div data-list-item-key-path="items.1"></div></section>',
    );

    expect(findFieldElement(container, 'items.1.title')?.dataset.listItemKeyPath).toBe('items.1');
    expect(findFieldElement(container, 'items.2.title')?.dataset.keyPath).toBe('items');
  });
});

describe('findLazyFieldElement()', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  /**
   * Render a list of three items, of which only the first is rendered, like the default preview.
   * @returns {HTMLElement} Container.
   */
  const renderList = () =>
    render(
      [
        '<section data-key-path="items">',
        '<div data-list-item-key-path="items.0"><p data-key-path="items.0.title">A</p></div>',
        '<div data-list-item-key-path="items.1"><div class="placeholder"></div></div>',
        '<div data-list-item-key-path="items.2"><div class="placeholder"></div></div>',
        '</section>',
      ].join(''),
    );

  /**
   * Render the given List item, like the preview does once it’s scrolled into view.
   * @param {HTMLElement} container Container.
   * @param {number} index Item index.
   * @param {string} html Item content.
   */
  const renderItem = (container, index, html) => {
    /** @type {HTMLElement} */ (
      container.querySelector(`[data-list-item-key-path="items.${index}"]`)
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

  test('settles for a parent other than a List item without scrolling', async () => {
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

  test('scrolls to the List item until its field is rendered', async () => {
    const container = renderList();

    const scrollTo = vi.fn((/** @type {HTMLElement} */ _target) => {
      renderItem(container, 2, '<p data-key-path="items.2.title">C</p>');

      return true;
    });

    const element = await findLazyFieldElement({
      container,
      keyPath: 'items.2.title',
      scrollTo,
      interval: 0,
    });

    expect(element?.textContent).toBe('C');
    expect(scrollTo).toHaveBeenCalledOnce();
    expect(scrollTo.mock.calls[0][0].dataset.listItemKeyPath).toBe('items.2');
  });

  test('scrolls to the last rendered field of the item, then further', async () => {
    const container = renderList();

    renderItem(
      container,
      1,
      '<p data-key-path="items.1.title">B</p><p data-key-path="items.1.body">Body</p><div></div>',
    );

    const scrollTo = vi.fn((/** @type {HTMLElement} */ _target) => {
      // The body’s neighbour is only rendered once the pane has been scrolled to it twice
      if (scrollTo.mock.calls.length === 2) {
        renderItem(
          container,
          1,
          '<p data-key-path="items.1.title">B</p><p data-key-path="items.1.body">Body</p>' +
            '<p data-key-path="items.1.image">Image</p>',
        );
      }

      return true;
    });

    const element = await findLazyFieldElement({
      container,
      keyPath: 'items.1.image',
      scrollTo,
      interval: 0,
    });

    expect(element?.textContent).toBe('Image');
    expect(scrollTo.mock.calls.map(([target]) => target.dataset.keyPath)).toEqual([
      'items.1.body',
      'items.1.body',
    ]);
  });

  test('settles for the parent once the pane can’t get any closer', async () => {
    const container = renderList();
    const scrollTo = vi.fn(() => scrollTo.mock.calls.length === 1);

    const element = await findLazyFieldElement({
      container,
      keyPath: 'items.2.title',
      scrollTo,
      interval: 0,
    });

    expect(element?.dataset.listItemKeyPath).toBe('items.2');
    expect(scrollTo).toHaveBeenCalledTimes(2);
  });

  test('keeps going while the target changes, even without scrolling', async () => {
    const container = renderList();

    const scrollTo = vi.fn(() => {
      if (scrollTo.mock.calls.length === 2) {
        renderItem(container, 2, '<p data-key-path="items.2.title">C</p>');
      } else {
        renderItem(container, 2, '<p data-key-path="items.2.other">D</p>');
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

    expect(element?.dataset.listItemKeyPath).toBe('items.2');
    expect(scrollTo).toHaveBeenCalledTimes(3);
  });

  test('uses the default options', async () => {
    const container = renderList();

    renderItem(container, 2, '<p data-key-path="items.2.title">C</p>');

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
