/**
 * Handle a key pressed within an editor component block, once the field controls in it have
 * handled the key. The block is a non-editable island in the outer rich text editor, so the key
 * must not reach the outer editor, while the controls in the block still get it.
 * @param {KeyboardEvent} event `keydown` event.
 * @param {object} options Options.
 * @param {HTMLElement | undefined} options.wrapper Element wrapping the block.
 * @param {boolean} options.readonly Whether the block is read-only.
 * @param {() => void} options.onRemove Function to call when the block itself is to be removed
 * with the Backspace key.
 */
export const handleComponentBlockKeyDown = (event, { wrapper, readonly, onRemove }) => {
  const { target } = /** @type {KeyboardEvent & { target: HTMLElement }} */ (event);

  // A nested rich text editor handles its own keys, so leave the event alone when it comes from
  // one: cancelling it would block typing there. The outer editor ignores the event once it
  // bubbles up, as Lexical marks it as handled by the nested one
  if (target.closest('[contenteditable]') !== wrapper) {
    return;
  }

  // Keep the outer editor from acting on the key, e.g. selecting all of its content with Ctrl+A
  // pressed in a `TextInput` within the block
  event.stopPropagation();

  // Keep the browser from editing the outer editor’s content, except in a text field or button,
  // and let Tab move the focus
  if (!target.matches('button, input, textarea') && event.key !== 'Tab') {
    event.preventDefault();
  }

  if (target === wrapper && event.key === 'Backspace' && !readonly) {
    onRemove();
  }
};
