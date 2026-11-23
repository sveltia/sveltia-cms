import { observeVisibility, whenSteadilyVisible } from '@sveltia/utils/element';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { whenThumbnailShown } from '$lib/services/utils/visibility';

const { stopObserving, cancelWait, addEventListener, scrollListener } = vi.hoisted(() => {
  /** @type {{ args?: any[] }} */
  const listener = {};

  return {
    stopObserving: vi.fn(),
    cancelWait: vi.fn(),
    // The listener is added once per module, by whichever test calls the function first
    addEventListener: vi.fn((...args) => {
      listener.args = args;
    }),
    scrollListener: listener,
  };
});

vi.mock('@sveltia/utils/element', () => ({
  observeVisibility: vi.fn(() => stopObserving),
  whenSteadilyVisible: vi.fn(() => cancelWait),
}));

describe('whenThumbnailShown()', () => {
  // Only passed through to the mocked functions
  const element = /** @type {Element} */ ({});

  /**
   * Report the given visibility to the listener passed to `observeVisibility()`.
   * @param {boolean} visible Whether the element is visible.
   */
  const report = (visible) => {
    const [, listener] = /** @type {any[]} */ (vi.mocked(observeVisibility).mock.lastCall);

    listener(visible);
  };

  beforeEach(() => {
    // Only its presence is checked; the observing itself is done by the mocked functions
    vi.stubGlobal('IntersectionObserver', vi.fn());
    vi.stubGlobal('addEventListener', addEventListener);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('calls back right away for an element already in view', () => {
    const callback = vi.fn();

    whenThumbnailShown(element, callback);
    expect(observeVisibility).toHaveBeenCalledWith(element, expect.any(Function));

    report(true);
    expect(stopObserving).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledOnce();
    expect(whenSteadilyVisible).not.toHaveBeenCalled();
  });

  test('waits for an element out of view to stay in view once it scrolls in', () => {
    const callback = vi.fn();
    const cancel = whenThumbnailShown(element, callback);

    report(false);
    expect(stopObserving).toHaveBeenCalledOnce();
    expect(callback).not.toHaveBeenCalled();
    expect(whenSteadilyVisible).toHaveBeenCalledWith(element, callback, {
      delay: 200,
      rootMargin: '200px 0px',
    });

    cancel();
    expect(cancelWait).toHaveBeenCalledOnce();
  });

  test('waits for an element in view to stay there while something is being scrolled', () => {
    const callback = vi.fn();

    whenThumbnailShown(element, callback);

    // A single listener catches the scrolling of any element
    const [type, onScroll, options] = /** @type {any[]} */ (scrollListener.args);

    expect(type).toBe('scroll');
    expect(options).toEqual({ capture: true, passive: true });

    onScroll();
    report(true);
    expect(callback).not.toHaveBeenCalled();
    expect(whenSteadilyVisible).toHaveBeenCalledWith(element, callback, {
      delay: 200,
      rootMargin: '200px 0px',
    });

    // The listener is only added once, by the first call in the module
    const callCount = addEventListener.mock.calls.length;

    whenThumbnailShown(element, callback);
    expect(addEventListener).toHaveBeenCalledTimes(callCount);
  });

  test('can be cancelled before the first report', () => {
    whenThumbnailShown(element, vi.fn())();

    expect(stopObserving).toHaveBeenCalledOnce();
    expect(cancelWait).not.toHaveBeenCalled();
  });

  test('leaves it to `whenSteadilyVisible()` without `IntersectionObserver`', () => {
    const callback = vi.fn();

    Reflect.deleteProperty(globalThis, 'IntersectionObserver');

    expect(whenThumbnailShown(element, callback)).toBe(cancelWait);
    expect(whenSteadilyVisible).toHaveBeenCalledWith(element, callback);
    expect(observeVisibility).not.toHaveBeenCalled();
  });
});
