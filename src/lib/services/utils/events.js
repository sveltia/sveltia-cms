/**
 * Check if the user agent is macOS.
 */
export const isMac =
  navigator.userAgentData?.platform === 'macOS' || navigator.platform.startsWith('Mac');

/**
 * Whether the event matches the given keyboard shortcut.
 * @param {KeyboardEvent} event `keydown` or `keypress` event.
 * @param {string} shortcut Keyboard shortcut, such as `Enter` or `Ctrl+F`. Note that, on macOS, the
 * primary modifier key is not Ctrl but Meta, so you should offer proper keyboard shortcuts by
 * detecting the user’s platform with {@link isMac}.
 * @returns {boolean} Result.
 * @see https://w3c.github.io/aria/#aria-keyshortcuts
 */
export const matchShortcut = (event, shortcut) => {
  const { ctrlKey, metaKey, altKey, shiftKey, key } = event;
  const keys = shortcut.split('+');

  // Check if required modifier keys are pressed
  if (
    (keys.includes('Ctrl') && !ctrlKey) ||
    (keys.includes('Meta') && !metaKey) ||
    (keys.includes('Alt') && !altKey) ||
    (keys.includes('Shift') && !shiftKey)
  ) {
    return false;
  }

  // Check if unnecessary modifier keys are not pressed
  if (
    (!keys.includes('Ctrl') && ctrlKey) ||
    (!keys.includes('Meta') && metaKey) ||
    (!keys.includes('Alt') && altKey) ||
    (!keys.includes('Shift') && shiftKey)
  ) {
    return false;
  }

  return keys
    .filter((_key) => !['Ctrl', 'Meta', 'Alt', 'Shift'].includes(_key))
    .every((_key) => _key.toUpperCase() === key.toUpperCase());
};
