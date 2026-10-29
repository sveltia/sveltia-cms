import { observeVisibility, whenSteadilyVisible } from '@sveltia/utils/element';

/**
 * Margin around the viewport within which a thumbnail that scrolls into view starts loading, so
 * it’s there by the time it’s seen.
 */
const THUMBNAIL_ROOT_MARGIN = '200px 0px';
/**
 * How long, in milliseconds, a thumbnail that scrolls into view has to stay there before it starts
 * loading. A row passes through the viewport and the margin in less than that while a list is
 * flung, so only the rows the scrolling slows down or stops at load their thumbnails.
 */
const THUMBNAIL_DWELL_TIME = 200;
/**
 * Time of the last scroll anywhere in the document, from `performance.now()`. `-Infinity` until
 * something has been scrolled.
 */
let lastScrollTime = -Infinity;
/**
 * Whether {@link lastScrollTime} is being kept up to date.
 */
let trackingScroll = false;

/**
 * Start keeping {@link lastScrollTime} up to date, if not done yet. A scroll event doesn’t bubble,
 * so it’s caught on its way down instead, from whichever element is scrolled.
 */
const trackScroll = () => {
  if (!trackingScroll) {
    trackingScroll = true;
    globalThis.addEventListener(
      'scroll',
      () => {
        lastScrollTime = performance.now();
      },
      { capture: true, passive: true },
    );
  }
};

/**
 * Call a function once the given thumbnail container is to be shown. One that’s in the viewport
 * when it’s first observed while nothing is being scrolled, as the first rows of a list or the
 * tiles of a grid that has just been opened, is shown right away. Otherwise it has to stay in or
 * near the viewport for a moment, so the rows a list is scrolled past, including those rendered
 * while it’s being scrolled, don’t queue up thumbnails ahead of the ones the user stops at.
 * @param {Element} element Element holding the thumbnail.
 * @param {() => void} callback Function to call.
 * @returns {() => void} Function to cancel the call if it hasn’t been made yet.
 */
export const whenThumbnailShown = (element, callback) => {
  // Without a way to tell, the thumbnail is shown right away, as `whenSteadilyVisible()` does
  if (!('IntersectionObserver' in globalThis)) {
    return whenSteadilyVisible(element, callback);
  }

  trackScroll();

  /** @type {(() => void) | undefined} */
  let cancelWait;

  // The first report tells whether the element is in the viewport now, without the margin
  const stopObserving = observeVisibility(element, (visible) => {
    stopObserving();

    if (visible && performance.now() - lastScrollTime > THUMBNAIL_DWELL_TIME) {
      callback();
    } else {
      cancelWait = whenSteadilyVisible(element, callback, {
        delay: THUMBNAIL_DWELL_TIME,
        rootMargin: THUMBNAIL_ROOT_MARGIN,
      });
    }
  });

  return () => {
    stopObserving();
    cancelWait?.();
  };
};
