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
 * parent, e.g. the section for a field that isn’t shown on its own. An element that isn’t rendered,
 * e.g. one with `display: none`, can’t be scrolled to, so it’s skipped.
 * @param {HTMLElement} container Content area of the other pane.
 * @param {string} keyPath Key path of the field.
 * @returns {HTMLElement | undefined} Element, if any.
 */
export const findFieldElement = (container, keyPath) => {
  const parts = keyPath.split('.');

  for (let depth = parts.length; depth > 0; depth -= 1) {
    const path = parts.slice(0, depth).join('.');

    const element = /** @type {HTMLElement | null} */ (
      container.querySelector(`[data-key-path="${CSS.escape(path)}"]`)
    );

    if (element?.getClientRects().length) {
      return element;
    }
  }

  return undefined;
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
 * @returns {number | undefined} Scroll position, or `undefined` if the element is already visible:
 * entirely, or partly if it’s taller than the pane.
 */
export const getRevealingScrollTop = ({ viewTop, viewHeight, scrollTop, top, height }) => {
  const offset = top - viewTop;
  const viewBottom = viewTop + viewHeight;
  const bottom = top + height;

  if (height > viewHeight) {
    return bottom > viewTop && top < viewBottom ? undefined : Math.max(0, scrollTop + offset);
  }

  if (top >= viewTop && bottom <= viewBottom) {
    return undefined;
  }

  return Math.max(0, scrollTop + offset - (viewHeight - height) / 2);
};
