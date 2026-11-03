/**
 * @import { Locator } from '@playwright/test';
 */

/**
 * Select a piece of text in a rich text editor. The editor picks up a selection made with the mouse
 * a moment later, when the browser fires `selectionchange`, so a shortcut pressed right after a
 * double-click can find nothing selected. Set the selection and fire the event instead, then wait
 * for the editor to have handled it.
 * @param {Locator} textbox Editor.
 * @param {string} text Text to select. Its first occurrence within a single text node is used.
 * @throws {Error} If the text isn’t found.
 */
export const selectText = async (textbox, text) => {
  await textbox.evaluate(async (element, _text) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    let found = false;

    for (let node = walker.nextNode(); node && !found; node = walker.nextNode()) {
      const index = node.textContent?.indexOf(_text) ?? -1;

      if (index > -1) {
        range.setStart(node, index);
        range.setEnd(node, index + _text.length);
        found = true;
      }
    }

    // Selecting nothing would make a test that expects no change pass for the wrong reason
    if (!found) {
      throw new Error(`Text not found in the editor: ${_text}`);
    }

    /** @type {HTMLElement} */ (element).focus();
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
    await new Promise((resolve) => {
      requestAnimationFrame(resolve);
    });
  }, text);
};

/**
 * Move the caret to the end of a rich text editor, or of an element within it such as a table cell.
 * The End key does that on Linux and Windows but not on macOS, so set the selection directly. As
 * with {@link selectText}, fire `selectionchange` and wait for the editor to have handled it: until
 * then, the editor acts on its own copy of the previous selection, so a toolbar button or a `paste`
 * event dispatched right away would replace whatever was selected before.
 * @param {Locator} target Editor, or an element within it.
 */
export const moveCaretToEnd = async (target) => {
  await target.evaluate(async (element) => {
    /** @type {HTMLElement} */ (element).focus();
    window.getSelection()?.selectAllChildren(element);
    window.getSelection()?.collapseToEnd();
    document.dispatchEvent(new Event('selectionchange'));
    await new Promise((resolve) => {
      requestAnimationFrame(resolve);
    });
  });
};
