// @vitest-environment happy-dom
// @ts-nocheck
/* eslint-disable jsdoc/require-jsdoc */

import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findLazyFieldElement: vi.fn(),
  getFieldAlignedScrollTop: vi.fn(),
  getProportionalScrollTop: vi.fn(),
  getRevealingScrollTop: vi.fn(),
}));

vi.mock('$lib/services/contents/editor/scroll', () => mocks);

/** @type {import('./scroll-sync')} */
let service;

/**
 * Create a stand-in for the other pane’s content area.
 * @param {object} [props] Properties to override.
 * @returns {any} Pane.
 */
const createThatPane = (props = {}) => {
  const pane = {
    scrollTop: 50,
    scrollHeight: 2000,
    clientHeight: 500,
    ownerDocument: { documentElement: {} },
    getBoundingClientRect: () => ({ top: 10 }),
    querySelector: vi.fn(),
    scrollTo: vi.fn(({ top }) => {
      pane.scrollTop = top;
    }),
    ...props,
  };

  return pane;
};

/**
 * Create a controller for a pane whose state is kept in the returned object.
 * @param {object} [overrides] State to override.
 * @returns {{ state: any, controller: ReturnType<typeof service.createScrollSync> }} Result.
 */
const setup = (overrides = {}) => {
  const state = {
    syncScrolling: true,
    mode: 'edit',
    contentArea: document.createElement('div'),
    thisPaneContentArea: undefined,
    thatPaneContentArea: createThatPane(),
    ...overrides,
  };

  document.body.append(state.contentArea);

  const controller = service.createScrollSync(state);

  return { state, controller };
};

/**
 * Put a content area below its top, where the other pane is synced to it rather than simply going
 * to its top along with it. A real element without a layout can’t be scrolled, so the position is
 * defined on it instead.
 * @param {HTMLElement} area Content area.
 * @param {number} [scrollTop] Position.
 */
const setScrollTop = (area, scrollTop = 100) => {
  Object.defineProperty(area, 'scrollTop', {
    configurable: true,
    writable: true,
    value: scrollTop,
  });
};

/**
 * Make the pane the one the user is scrolling, and let it scroll.
 * @param {any} state Pane state.
 * @param {number} [scrollTop] Position the pane is scrolled to.
 */
const scrollByUser = (state, scrollTop = 100) => {
  setScrollTop(state.thisPaneContentArea, scrollTop);
  state.thisPaneContentArea.dispatchEvent(new Event('wheel'));
  state.thisPaneContentArea.dispatchEvent(new Event('scroll'));
};

/**
 * Create a focus event on a field in the given container.
 * @param {HTMLElement} container Container.
 * @returns {{ event: any, field: HTMLElement }} Event and field.
 */
const createFocusEvent = (container) => {
  const field = document.createElement('div');
  const input = document.createElement('input');

  field.className = 'field';
  field.dataset.keyPath = 'title';
  field.append(input);
  container.append(field);

  return { event: { target: input }, field };
};

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  document.body.innerHTML = '';
  document.elementsFromPoint = vi.fn(() => []);

  window.requestAnimationFrame = (callback) => {
    callback(0);

    return 0;
  };

  service = await import('./scroll-sync');
});

describe('getContentTop()', () => {
  test('measures an element from the top of the pane’s content in the main document', () => {
    // The element is 290px below the top of the pane, which has been scrolled by 50px
    const element = { getBoundingClientRect: () => ({ top: 300, height: 40 }) };
    const pane = createThatPane();

    expect(service.getContentTop(pane, element)).toBe(340);
  });

  test('measures an element from the top of the viewport in the preview iframe', () => {
    const element = { getBoundingClientRect: () => ({ top: 300, height: 40 }) };
    const pane = createThatPane();

    pane.ownerDocument.documentElement = pane;

    expect(service.getContentTop(pane, element)).toBe(350);
  });
});

describe('getThatScrollTop()', () => {
  test('uses the top of the pane as the view for an element in the main document', () => {
    mocks.getRevealingScrollTop.mockReturnValue(120);

    const element = { getBoundingClientRect: () => ({ top: 300, height: 40 }) };
    const pane = createThatPane({ ownerDocument: { documentElement: {} } });

    expect(service.getThatScrollTop(pane, element, true)).toBe(120);

    expect(mocks.getRevealingScrollTop).toHaveBeenCalledWith({
      viewTop: 10,
      viewHeight: 500,
      scrollTop: 50,
      top: 300,
      height: 40,
      always: true,
    });
  });

  test('uses the top of the viewport for the root element of an iframe', () => {
    const element = { getBoundingClientRect: () => ({ top: 300, height: 40 }) };
    const pane = createThatPane();

    pane.ownerDocument.documentElement = pane;
    service.getThatScrollTop(pane, element);

    expect(mocks.getRevealingScrollTop).toHaveBeenCalledWith(
      expect.objectContaining({ viewTop: 0, always: false }),
    );
  });
});

describe('createScrollSync().initialize()', () => {
  test('does nothing without a content area', () => {
    const { state, controller } = setup({ contentArea: undefined });

    controller.initialize();

    expect(state.thisPaneContentArea).toBeUndefined();
  });

  test('listens to the main content area, and replaces the listeners when called again', () => {
    const { state, controller } = setup();
    const { contentArea } = state;
    const remove = vi.spyOn(contentArea, 'removeEventListener');
    const add = vi.spyOn(contentArea, 'addEventListener');

    contentArea.scrollTop = 99;
    controller.initialize();

    expect(state.thisPaneContentArea).toBe(contentArea);
    expect(contentArea.scrollTop).toBe(0);
    expect(add.mock.calls.map(([type]) => type)).toEqual(['wheel', 'touchstart', 'scroll']);
    expect(remove).not.toHaveBeenCalled();

    controller.initialize();

    expect(remove.mock.calls.map(([type]) => type)).toEqual(['wheel', 'touchstart', 'scroll']);
  });

  test('listens to the root element of the preview iframe once it has loaded', () => {
    const { state, controller } = setup();
    const root = document.createElement('html');
    const iframe = { contentDocument: { documentElement: root } };

    state.contentArea.contains = () => true;
    controller.initialize();
    controller.setPreviewFrame(iframe);
    controller.initialize();

    expect(state.thisPaneContentArea).toBe(root);
  });

  test('forgets a preview iframe that is gone, or has no document', () => {
    const { state, controller } = setup();
    const gone = { contentDocument: { documentElement: document.createElement('html') } };
    const detached = { contentDocument: null };

    controller.setPreviewFrame(gone);
    controller.initialize();

    expect(state.thisPaneContentArea).toBe(state.contentArea);

    state.contentArea.contains = () => true;
    controller.setPreviewFrame(detached);
    controller.initialize();

    expect(state.thisPaneContentArea).toBe(state.contentArea);
  });
});

describe('createScrollSync() scroll syncing', () => {
  test('scrolls the other pane in proportion when no field is at the top', () => {
    mocks.getProportionalScrollTop.mockReturnValue(321);

    const { state, controller } = setup();

    controller.initialize();
    scrollByUser(state);

    expect(mocks.getProportionalScrollTop).toHaveBeenCalledWith(
      expect.objectContaining({ targetScrollHeight: 2000, targetClientHeight: 500 }),
    );

    expect(state.thatPaneContentArea.scrollTop).toBe(321);
  });

  test('scrolls the other pane to its top along with this one', () => {
    const { state, controller } = setup();
    const thisField = document.createElement('div');

    thisField.dataset.keyPath = 'title';
    document.elementsFromPoint = vi.fn(() => [thisField]);
    controller.initialize();
    scrollByUser(state, 0);

    // The field at the top isn’t aligned, which would leave the padding above it out of view
    expect(document.elementsFromPoint).not.toHaveBeenCalled();
    expect(state.thatPaneContentArea.scrollTop).toBe(0);
  });

  test('aligns the matching field of the other pane', () => {
    mocks.getFieldAlignedScrollTop.mockReturnValue(77);

    const { state, controller } = setup();
    const thisField = document.createElement('div');
    // The field’s offset parent isn’t the pane, so only its position on the screen tells where it
    // is in the pane
    const thatField = { offsetTop: 0, getBoundingClientRect: () => ({ top: 410, height: 60 }) };

    thisField.dataset.keyPath = 'body';
    thisField.getBoundingClientRect = () => ({ top: 5, height: 30 });
    document.elementsFromPoint = vi.fn(() => [document.body, thisField]);
    state.thatPaneContentArea.querySelector = vi.fn(() => thatField);
    controller.initialize();
    scrollByUser(state);

    expect(state.thatPaneContentArea.querySelector).toHaveBeenCalledWith('[data-key-path="body"]');

    expect(mocks.getFieldAlignedScrollTop).toHaveBeenCalledWith(
      expect.objectContaining({ targetTop: 450, targetHeight: 60, top: 5, height: 30 }),
    );

    expect(state.thatPaneContentArea.scrollTop).toBe(77);
  });

  test('uses the top left of the viewport for an iframe', () => {
    const { state, controller } = setup();
    const root = document.createElement('html');
    const iframe = { contentDocument: { documentElement: root } };

    state.contentArea.contains = () => true;
    controller.setPreviewFrame(iframe);
    controller.initialize();
    setScrollTop(root);
    // The scroll events of the frame’s root element come from its document
    state.thisPaneContentArea.dispatchEvent(new Event('wheel'));
    document.dispatchEvent(new Event('scroll'));

    expect(document.elementsFromPoint).toHaveBeenCalledWith(80, 0);
    expect(mocks.getProportionalScrollTop).toHaveBeenCalled();
  });

  test('leaves the other pane alone when there is no matching field or position', () => {
    mocks.getFieldAlignedScrollTop.mockReturnValue(undefined);

    const { state, controller } = setup();
    const thisField = document.createElement('div');

    thisField.dataset.keyPath = 'a';
    thisField.getBoundingClientRect = () => ({ top: 5, height: 30 });
    document.elementsFromPoint = vi.fn(() => [thisField]);
    controller.initialize();

    // No matching field
    scrollByUser(state);

    expect(mocks.getFieldAlignedScrollTop).not.toHaveBeenCalled();

    // The top of the pane is not within the field
    state.thatPaneContentArea.querySelector = vi.fn(() => ({
      getBoundingClientRect: () => ({ top: 1, height: 1 }),
    }));
    scrollByUser(state);

    expect(mocks.getFieldAlignedScrollTop).toHaveBeenCalled();
    expect(state.thatPaneContentArea.scrollTop).toBe(50);
  });

  test('does nothing when Sync Scrolling is off or the other pane is missing', () => {
    const { state, controller } = setup({ syncScrolling: false });

    controller.initialize();
    scrollByUser(state);
    state.syncScrolling = true;
    state.thatPaneContentArea = undefined;
    scrollByUser(state);
    state.thatPaneContentArea = createThatPane();
    state.contentArea = undefined;
    scrollByUser(state);

    expect(mocks.getProportionalScrollTop).not.toHaveBeenCalled();
  });

  test('ignores scrolling that the user has not made', () => {
    const { state, controller } = setup();

    controller.initialize();
    state.thisPaneContentArea.dispatchEvent(new Event('scroll'));

    expect(mocks.getProportionalScrollTop).not.toHaveBeenCalled();
  });

  test('follows a touch too', () => {
    const { state, controller } = setup();

    controller.initialize();
    setScrollTop(state.thisPaneContentArea);
    state.thisPaneContentArea.dispatchEvent(new Event('touchstart'));
    state.thisPaneContentArea.dispatchEvent(new Event('scroll'));

    expect(mocks.getProportionalScrollTop).toHaveBeenCalled();
  });

  test('stops following the pane once it has been destroyed', () => {
    const { state, controller } = setup();

    controller.initialize();
    state.thisPaneContentArea.dispatchEvent(new Event('wheel'));
    controller.destroy();
    state.thisPaneContentArea.dispatchEvent(new Event('scroll'));

    expect(mocks.getProportionalScrollTop).not.toHaveBeenCalled();
  });

  test('keeps the scroll source of the other pane when destroyed', () => {
    const first = setup();
    const second = setup();

    first.controller.initialize();
    second.controller.initialize();
    setScrollTop(first.state.thisPaneContentArea);
    first.state.thisPaneContentArea.dispatchEvent(new Event('wheel'));
    second.controller.destroy();
    first.state.thisPaneContentArea.dispatchEvent(new Event('scroll'));

    expect(mocks.getProportionalScrollTop).toHaveBeenCalledTimes(1);
  });
});

describe('createScrollSync().onFocusIn()', () => {
  test('ignores focus outside the edit mode or outside a field', () => {
    const { state, controller } = setup({ mode: 'preview' });
    const { event } = createFocusEvent(state.contentArea);

    controller.initialize();
    controller.onFocusIn(event);
    state.mode = 'edit';
    controller.onFocusIn({ target: document.createElement('input') });

    expect(mocks.findLazyFieldElement).not.toHaveBeenCalled();
  });

  test('does nothing when Sync Scrolling is off, the panes are missing or the field is gone', () => {
    const { state, controller } = setup({ syncScrolling: false });
    const { event, field } = createFocusEvent(state.contentArea);

    controller.initialize();
    controller.onFocusIn(event);
    state.syncScrolling = true;
    state.thatPaneContentArea = undefined;
    controller.onFocusIn(event);
    state.thatPaneContentArea = createThatPane();
    state.thisPaneContentArea = undefined;
    controller.onFocusIn(event);
    state.thisPaneContentArea = state.contentArea;
    field.remove();
    controller.onFocusIn(event);

    expect(mocks.findLazyFieldElement).not.toHaveBeenCalled();
  });

  test('scrolls the other pane smoothly to the field found', async () => {
    mocks.findLazyFieldElement.mockResolvedValue({
      getBoundingClientRect: () => ({ top: 0, height: 0 }),
    });
    mocks.getRevealingScrollTop.mockReturnValue(250);

    const { state, controller } = setup();
    const { event } = createFocusEvent(state.contentArea);

    state.contentArea.getBoundingClientRect = () => ({ top: 0 });
    controller.initialize();
    controller.onFocusIn(event);

    await vi.waitFor(() => {
      expect(state.thatPaneContentArea.scrollTo).toHaveBeenCalledWith({
        top: 250,
        behavior: 'smooth',
      });
    });

    expect(mocks.findLazyFieldElement).toHaveBeenCalledWith(
      expect.objectContaining({ container: state.thatPaneContentArea, keyPath: 'title' }),
    );

    // The panes must not chase each other: this pane is the scroll source
    setScrollTop(state.thisPaneContentArea);
    state.thisPaneContentArea.dispatchEvent(new Event('scroll'));

    expect(mocks.getProportionalScrollTop).toHaveBeenCalled();
  });

  test('does not scroll when the field is already visible', async () => {
    mocks.findLazyFieldElement.mockResolvedValue({
      getBoundingClientRect: () => ({ top: 0, height: 0 }),
    });
    mocks.getRevealingScrollTop.mockReturnValue(undefined);

    const { state, controller } = setup();
    const { event } = createFocusEvent(state.contentArea);

    controller.initialize();
    controller.onFocusIn(event);

    await vi.waitFor(() => {
      expect(mocks.getRevealingScrollTop).toHaveBeenCalled();
    });

    expect(state.thatPaneContentArea.scrollTo).not.toHaveBeenCalled();
  });

  test('scrolls instantly towards a lazily rendered field, and tells when it is outdated', async () => {
    mocks.getRevealingScrollTop.mockReturnValue(900);

    /** @type {any} */
    let args;

    mocks.findLazyFieldElement.mockImplementation(async (a) => {
      args = a;

      return undefined;
    });

    const { state, controller } = setup();
    const { event } = createFocusEvent(state.contentArea);

    controller.initialize();
    controller.onFocusIn(event);

    await vi.waitFor(() => {
      expect(args).toBeDefined();
    });

    // The pane moves, so it has been scrolled
    expect(args.scrollTo({ getBoundingClientRect: () => ({ top: 0, height: 0 }) })).toBe(true);

    expect(state.thatPaneContentArea.scrollTo).toHaveBeenCalledWith({
      top: 900,
      behavior: 'instant',
    });

    // A subpixel move does not count
    state.thatPaneContentArea.scrollTo = vi.fn(({ top }) => {
      state.thatPaneContentArea.scrollTop = top;
    });
    mocks.getRevealingScrollTop.mockReturnValue(900.4);

    expect(args.scrollTo({ getBoundingClientRect: () => ({ top: 0, height: 0 }) })).toBe(false);
    expect(args.isOutdated()).toBe(false);

    state.syncScrolling = false;

    expect(args.isOutdated()).toBe(true);

    state.syncScrolling = true;
    state.thisPaneContentArea.dispatchEvent(new Event('wheel'));

    expect(args.isOutdated()).toBe(true);
  });

  test('puts the other pane back when the field turns out not to be shown', async () => {
    mocks.getRevealingScrollTop.mockReturnValue(900);
    mocks.findLazyFieldElement.mockImplementation(async ({ scrollTo }) => {
      scrollTo({ getBoundingClientRect: () => ({ top: 0, height: 0 }) });

      return undefined;
    });

    const { state, controller } = setup();
    const { event } = createFocusEvent(state.contentArea);

    controller.initialize();
    controller.onFocusIn(event);

    await vi.waitFor(() => {
      expect(state.thatPaneContentArea.scrollTo).toHaveBeenCalledWith({
        top: 50,
        behavior: 'instant',
      });
    });
  });

  test('leaves the other pane alone when the search was abandoned or it did not move', async () => {
    mocks.findLazyFieldElement.mockResolvedValue(undefined);

    const { state, controller } = setup();
    const { event } = createFocusEvent(state.contentArea);

    controller.initialize();

    // Did not move
    controller.onFocusIn(event);

    await vi.waitFor(() => {
      expect(mocks.findLazyFieldElement).toHaveBeenCalledTimes(1);
    });

    // Sync Scrolling turned off meanwhile
    mocks.findLazyFieldElement.mockImplementation(async ({ scrollTo }) => {
      mocks.getRevealingScrollTop.mockReturnValue(900);
      scrollTo({ getBoundingClientRect: () => ({ top: 0, height: 0 }) });
      state.syncScrolling = false;

      return undefined;
    });
    state.thatPaneContentArea.scrollTo.mockClear();
    controller.onFocusIn(event);

    await vi.waitFor(() => {
      expect(mocks.findLazyFieldElement).toHaveBeenCalledTimes(2);
    });

    await Promise.resolve();

    // Only the instant scroll towards the field was made, without putting the pane back
    expect(state.thatPaneContentArea.scrollTo).toHaveBeenCalledTimes(1);
  });
});
