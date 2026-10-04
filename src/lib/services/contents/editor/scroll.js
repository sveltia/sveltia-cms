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
