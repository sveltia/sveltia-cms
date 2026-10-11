// @vitest-environment happy-dom

import { describe, expect, test, vi } from 'vitest';

import { initComposingEscapeGuard } from './keyboard';

describe('initComposingEscapeGuard', () => {
  test('stops the Escape key pressed during an IME composition', () => {
    initComposingEscapeGuard();
    // A second call doesn’t add another listener
    initComposingEscapeGuard();

    // Added later, like the shortcut handler of `@sveltia/utils`
    const listener = vi.fn();

    window.addEventListener('keydown', listener, { capture: true });

    /**
     * Dispatch a `keydown` event on the window.
     * @param {KeyboardEventInit & { keyCode?: number }} init Event details.
     */
    const press = (init) => {
      window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }));
    };

    // Chrome and Firefox
    press({ key: 'Process', code: 'Escape', isComposing: true });
    // Safari, right after the composition has ended
    press({ key: 'Escape', code: 'Escape', keyCode: 229 });
    expect(listener).not.toHaveBeenCalled();

    // Other keys during a composition, and the Escape key otherwise, go through
    press({ key: 'Process', code: 'KeyA', isComposing: true });
    press({ key: 'Escape', code: 'Escape' });
    expect(listener).toHaveBeenCalledTimes(2);

    window.removeEventListener('keydown', listener, { capture: true });
  });
});
