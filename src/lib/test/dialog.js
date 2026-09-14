import { expect } from 'vitest';

/**
 * Wait for the rename dialog to be ready for typing: the dialog focuses its input and selects the
 * whole name once open, and the input narrows that first selection down to the file name. Typing
 * before then would replace the file name only, leaving the extension in place.
 * @param {import('vitest/browser').Locator} textbox The dialog’s input field.
 * @param {string} name The name shown in the field.
 * @returns {Promise<void>}
 */
export const waitForRenameDialog = async (textbox, name) => {
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
