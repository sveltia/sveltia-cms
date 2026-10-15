import { expect } from 'vitest';
import { page } from 'vitest/browser';

/**
 * Move the pointer to the top-left corner of the page, which the toast base, inset from the edges,
 * never covers. A Sveltia UI toast holds its auto-hide countdown while the pointer is over it, and
 * the pointer stays wherever an earlier test file run in the same browser tab left it, so a toast
 * shown under it would never hide.
 */
const movePointerAway = async () => {
  const spot = document.createElement('div');

  spot.dataset.testid = 'pointer-rest';
  Object.assign(spot.style, {
    position: 'fixed',
    inset: '0 auto auto 0',
    width: '1px',
    height: '1px',
  });
  document.body.append(spot);

  try {
    // A modal dialog’s backdrop may cover the corner, which is fine: it’s not a toast
    await page.getByTestId('pointer-rest').hover({ force: true });
  } finally {
    spot.remove();
  }
};

/**
 * Wait for the Sveltia UI toasts shown on the page to hide themselves, which they do after a few
 * seconds unless told otherwise. This lets a test see a toast’s `show` state being written back to
 * the component that owns it. The pointer is moved off the toasts first, as hovering one holds it.
 * @returns {Promise<void>}
 */
export const waitForToastsToHide = async () => {
  await movePointerAway();
  await expect
    .poll(
      () =>
        [...document.querySelectorAll('.sui.toast')].every(
          (toast) => toast.getAttribute('aria-hidden') === 'true',
        ),
      { timeout: 8000 },
    )
    .toBe(true);
};
