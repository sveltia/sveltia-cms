import { expect } from 'vitest';

/**
 * Expect a rename input to have the focus, with the file name selected without the extension, as
 * the Rename dialog and the file field’s Rename option do.
 * @param {import('vitest/browser').Locator} textbox The dialog’s input field.
 * @param {string} name The name shown in the field.
 * @returns {Promise<void>}
 */
export const expectFileNameSelected = async (textbox, name) => {
  await expect.element(textbox).toHaveValue(name);
  await expect
    .poll(() => {
      const input = /** @type {HTMLInputElement} */ (textbox.element());

      return (
        document.activeElement === input &&
        input.selectionStart === 0 &&
        input.selectionEnd === name.lastIndexOf('.')
      );
    })
    .toBe(true);
};
