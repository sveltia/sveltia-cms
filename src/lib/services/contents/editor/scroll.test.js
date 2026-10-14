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
