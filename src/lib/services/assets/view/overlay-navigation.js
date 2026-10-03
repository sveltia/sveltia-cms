/**
 * @import { AssetNavigationDirection } from '$lib/types/private';
 */

/**
 * Minimum horizontal travel of a touch, in pixels, to count as a swipe rather than a tap.
 */
export const SWIPE_MIN_DISTANCE = 50;

/**
 * Elements that use the arrow keys themselves, e.g. to move the caret or to seek in a video, and
 * composite widgets that move the focus between their children with the keys.
 */
export const ARROW_KEY_USER_SELECTOR = [
  'input',
  'textarea',
  'select',
  'audio',
  'video',
  '[role="grid"]',
  '[role="listbox"]',
  '[role="menu"]',
  '[role="menubar"]',
  '[role="radiogroup"]',
  '[role="slider"]',
  '[role="tablist"]',
].join(', ');

/**
 * Elements that are dragged sideways themselves, e.g. the timeline and volume controls of a media
 * player, so a touch on them is never a swipe.
 */
export const SWIPE_USER_SELECTOR = 'audio, video, input, [role="slider"]';

/**
 * Get the direction to move in with an arrow key: the left arrow key moves to the previous asset
 * and the right arrow key to the next asset, or the other way around in a right-to-left locale. Key
 * presses outside the overlay, e.g. in a dialog, and those that mean something else where the focus
 * is are left alone.
 * @param {KeyboardEvent} event `keydown` event.
 * @param {object} options Options.
 * @param {HTMLElement | undefined} options.container Overlay element.
 * @param {boolean} options.rtl Whether the UI locale is written right to left.
 * @returns {AssetNavigationDirection | undefined} Direction, or `undefined` if the key press isn’t
 * a move.
 */
export const getArrowKeyDirection = (event, { container, rtl }) => {
  const { key, ctrlKey, metaKey, altKey, shiftKey, target } = event;

  if (!['ArrowLeft', 'ArrowRight'].includes(key) || ctrlKey || metaKey || altKey || shiftKey) {
    return undefined;
  }

  // The focus lands on the body when the focused button gets disabled at the end of the list
  if (
    !(target instanceof HTMLElement) ||
    !(target === document.body || container?.contains(target)) ||
    target.isContentEditable ||
    target.closest(ARROW_KEY_USER_SELECTOR)
  ) {
    return undefined;
  }

  return key === (rtl ? 'ArrowRight' : 'ArrowLeft') ? 'previous' : 'next';
};

/**
 * Check if a touch starting on the given element can be a swipe.
 * @param {EventTarget | null} target Element the touch started on.
 * @returns {boolean} Result.
 */
export const canSwipeOn = (target) =>
  !(target instanceof Element && target.closest(SWIPE_USER_SELECTOR));

/**
 * Get the direction to move in with a swipe: a swipe towards the end of the line moves to the
 * previous asset, and a swipe towards the start to the next asset, as if the assets were laid out
 * in a row. A mostly vertical move is a scroll, not a swipe.
 * @param {object} args Arguments.
 * @param {{ x: number, y: number }} args.start Where the touch started.
 * @param {{ x: number, y: number }} args.end Where the touch ended.
 * @param {boolean} args.rtl Whether the UI locale is written right to left.
 * @returns {AssetNavigationDirection | undefined} Direction, or `undefined` if the touch isn’t a
 * swipe.
 */
export const getSwipeDirection = ({ start, end, rtl }) => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  if (Math.abs(dx) < SWIPE_MIN_DISTANCE || Math.abs(dx) < Math.abs(dy)) {
    return undefined;
  }

  return (rtl ? dx < 0 : dx > 0) ? 'previous' : 'next';
};
