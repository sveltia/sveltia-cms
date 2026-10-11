/**
 * Whether {@link initComposingEscapeGuard} has added its listener.
 */
let guarding = false;

/**
 * Stop a `keydown` event of the Escape key pressed to cancel an IME composition, e.g. a Japanese
 * or Chinese conversion, so that it doesn’t also trigger a keyboard shortcut, like the one closing
 * the entry editor. Chrome and Firefox flag such an event with `isComposing`, while Safari sends it
 * right after the composition has ended, only identifiable by the `keyCode` of `229`.
 * @param {KeyboardEvent} event `keydown` event.
 */
const stopComposingEscape = (event) => {
  if (event.code === 'Escape' && (event.isComposing || event.keyCode === 229)) {
    event.stopImmediatePropagation();
  }
};

/**
 * Keep the Escape key pressed during an IME composition from triggering a keyboard shortcut. The
 * shortcuts of Sveltia UI buttons are handled by a capture-phase `keydown` listener on `window`,
 * added by `@sveltia/utils` once the first shortcut is registered and matching `KeyboardEvent.code`
 * without checking the composition state. Listeners on the same target run in the order they are
 * added, so this has to be called before any component with a shortcut is mounted.
 */
export const initComposingEscapeGuard = () => {
  if (!guarding) {
    guarding = true;
    window.addEventListener('keydown', stopComposingEscape, { capture: true });
  }
};
