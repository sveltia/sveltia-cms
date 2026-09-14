import { expect } from 'vitest';

/**
 * Wait for the Sveltia UI toasts shown on the page to hide themselves, which they do after a few
 * seconds unless told otherwise. This lets a test see a toast’s `show` state being written back to
 * the component that owns it.
 * @returns {Promise<void>}
 */
export const waitForToastsToHide = async () => {
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
