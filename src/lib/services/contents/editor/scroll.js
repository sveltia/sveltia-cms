import { sleep } from '@sveltia/utils/misc';

/**
 * Get the scroll position of another pane that matches the given pane’s scroll position in
 * proportion, when no field can be matched between the panes.
 * @param {object} args Arguments.
 * @param {number} args.scrollTop Scroll position of the pane being scrolled.
 * @param {number} args.scrollHeight Scroll height of the pane being scrolled.
 * @param {number} args.clientHeight Client height of the pane being scrolled.
 * @param {number} args.targetScrollHeight Scroll height of the other pane.
 * @param {number} args.targetClientHeight Client height of the other pane.
 * @returns {number} Scroll position for the other pane.
 */
export const getProportionalScrollTop = ({
  scrollTop,
  scrollHeight,
  clientHeight,
  targetScrollHeight,
  targetClientHeight,
}) => {
  const scrollRange = scrollHeight - clientHeight;

  // The pane being scrolled can’t actually scroll, so there is no proportion to match
  if (scrollRange <= 0) {
    return 0;
  }

  return Math.max(0, targetScrollHeight - targetClientHeight) * (scrollTop / scrollRange);
};

/**
 * Get the scroll position of another pane that brings the field matching the one at the top of the
 * pane being scrolled to the same place, at the same relative position within the field.
 * @param {object} args Arguments.
 * @param {number} args.y Top of the content area being scrolled, in the viewport.
 * @param {number} args.top Top of the field at the top of the content area, in the viewport.
 * @param {number} args.height Height of that field.
 * @param {number} args.targetOffsetTop Offset top of the matching field in the other pane.
 * @param {number} args.targetHeight Client height of the matching field.
 * @returns {number | undefined} Scroll position for the other pane, or `undefined` if the top of
 * the content area isn’t within the field.
 */
export const getFieldAlignedScrollTop = ({ y, top, height, targetOffsetTop, targetHeight }) => {
  const ratio = (y - top) / height;

  if (ratio < 0 || ratio > 1) {
    return undefined;
  }

  return targetOffsetTop - y + targetHeight * ratio;
};

/**
 * Find the element in another pane that shows the given field, or the one that shows its nearest
 * parent, e.g. the section for a field that isn’t shown on its own. The default preview renders its
 * fields lazily, and marks the element around each of them with the `data-lazy-key-path` attribute,
 * which Scroll Synchronization and Click-to-Highlight don’t use, so a field not rendered yet falls
 * back to that wrapper rather than its parent or nothing at all. An element that isn’t rendered,
 * e.g. one with `display: none`, can’t be scrolled to, so it’s skipped, and so is a wrapper with
 * neither a placeholder nor the field in it, as the field isn’t shown in the preview.
 * @param {HTMLElement} container Content area of the other pane.
 * @param {string} keyPath Key path of the field.
 * @returns {HTMLElement | undefined} Element, if any.
 */
export const findFieldElement = (container, keyPath) => {
  const parts = keyPath.split('.');

  for (let depth = parts.length; depth > 0; depth -= 1) {
    const path = CSS.escape(parts.slice(0, depth).join('.'));

    // Prefer the field’s own element to the wrapper around it
    const element = /** @type {HTMLElement | null} */ (
      container.querySelector(`[data-key-path="${path}"]`)
    );

    if (element?.getClientRects().length) {
      return element;
    }

    // Prefer the innermost wrapper, e.g. the one around the single subfield of a List item to the
    // one around the item, which have the same key path. A wrapper around the field’s own element,
    // which was skipped above, has rendered it already, so it has nothing more to show
    const wrapper = /** @type {HTMLElement[]} */ ([
      ...container.querySelectorAll(`[data-lazy-key-path="${path}"]`),
    ]).findLast(
      (_wrapper) =>
        _wrapper.childElementCount &&
        _wrapper.getClientRects().length &&
        !(element && _wrapper.contains(element)),
    );

    if (wrapper) {
      return wrapper;
    }
  }

  return undefined;
};

/**
 * Find the element in another pane that shows the given field, like `findFieldElement()`, in a pane
 * that renders its fields lazily as they scroll into view: the default preview. While only the
 * wrapper of a field or one of its parents is found, scroll the pane to it and look again once the
 * fields that came into view are rendered, until the field is found or scrolling makes no more
 * progress. Scrolling past the placeholders above the field renders them, which moves the field,
 * and a parent renders the wrappers of its subfields in turn, so it can take a few rounds.
 * @param {object} args Arguments.
 * @param {HTMLElement} args.container Content area of the other pane.
 * @param {string} args.keyPath Key path of the field.
 * @param {(element: HTMLElement) => boolean} args.scrollTo Function scrolling the pane to the given
 * element instantly, and telling whether the pane has been scrolled.
 * @param {() => boolean} [args.isOutdated] Function telling whether the request has been superseded
 * by a newer one, in which case the search is abandoned.
 * @param {number} [args.maxAttempts] How many times to scroll the pane before giving up.
 * @param {number} [args.interval] How long to wait for fields to render after scrolling, in
 * milliseconds.
 * @returns {Promise<HTMLElement | undefined>} Element showing the field or, if it couldn’t be
 * rendered, its nearest parent or wrapper. `undefined` if there’s none or the request is outdated.
 * @see https://github.com/sveltia/sveltia-cms/issues/1073
 */
export const findLazyFieldElement = async ({
  container,
  keyPath,
  scrollTo,
  isOutdated = () => false,
  maxAttempts = 20,
  interval = 100,
}) => {
  /** @type {HTMLElement | undefined} */
  let previousElement;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const element = findFieldElement(container, keyPath);

    // Only a wrapper renders its content lazily. Any other element found is the field’s own or a
    // parent that has rendered everything in it, so there’s nothing more to look for
    if (element?.dataset.lazyKeyPath === undefined) {
      return element;
    }

    const scrolled = scrollTo(element);

    // Stop if the pane can’t get any closer to the field, e.g. when it isn’t shown in the preview
    if (!scrolled && element === previousElement) {
      return element;
    }

    previousElement = element;

    // eslint-disable-next-line no-await-in-loop
    await sleep(interval);

    if (isOutdated()) {
      return undefined;
    }
  }

  return findFieldElement(container, keyPath);
};

/**
 * Get the scroll position of a pane that reveals the given element: centered in the pane, or
 * aligned to its top if the element is taller than the pane.
 * @param {object} args Arguments.
 * @param {number} args.viewTop Top of the pane’s visible area, in the viewport.
 * @param {number} args.viewHeight Height of the pane’s visible area.
 * @param {number} args.scrollTop Current scroll position of the pane.
 * @param {number} args.top Top of the element, in the viewport.
 * @param {number} args.height Height of the element.
 * @param {boolean} [args.always] Whether to get the position even if the element is already
 * visible.
 * @returns {number | undefined} Scroll position, or `undefined` if the element is already visible:
 * entirely, or partly if it’s taller than the pane.
 */
export const getRevealingScrollTop = ({
  viewTop,
  viewHeight,
  scrollTop,
  top,
  height,
  always = false,
}) => {
  const offset = top - viewTop;
  const viewBottom = viewTop + viewHeight;
  const bottom = top + height;

  if (height > viewHeight) {
    return !always && bottom > viewTop && top < viewBottom
      ? undefined
      : Math.max(0, scrollTop + offset);
  }

  if (!always && top >= viewTop && bottom <= viewBottom) {
    return undefined;
  }

  return Math.max(0, scrollTop + offset - (viewHeight - height) / 2);
};
