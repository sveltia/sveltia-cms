// @vitest-environment happy-dom

import { beforeEach, describe, expect, test, vi } from 'vitest';

import { handleComponentBlockKeyDown } from '$lib/services/contents/fields/rich-text/components/keyboard';

describe('handleComponentBlockKeyDown', () => {
  /** @type {HTMLElement} */
  let wrapper;
  /** @type {HTMLElement} */
  let nestedEditor;
  let readonly = false;
  const onRemove = vi.fn();

  beforeEach(() => {
    document.body.innerHTML = `
      <div contenteditable="true">
        <div id="wrapper" contenteditable="false" tabindex="0">
          <input id="input">
          <button id="button" type="button"></button>
          <textarea id="textarea"></textarea>
          <span id="label" tabindex="0"></span>
          <div id="nested" contenteditable="true"><p id="paragraph"></p></div>
        </div>
      </div>
    `;
    wrapper = /** @type {HTMLElement} */ (document.getElementById('wrapper'));
    nestedEditor = /** @type {HTMLElement} */ (document.getElementById('nested'));
    readonly = false;
    wrapper.addEventListener('keydown', (event) =>
      handleComponentBlockKeyDown(event, { wrapper, readonly, onRemove }),
    );
  });

  /**
   * Dispatch a `keydown` event on the given element.
   * @param {string} id ID of the target element.
   * @param {string} key Key.
   * @returns {{ event: KeyboardEvent, bubbled: boolean }} Event, and whether it reached the
   * document.
   */
  const press = (id, key) => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    let bubbled = false;

    /**
     * Record that the event reached the document.
     */
    const listener = () => {
      bubbled = true;
    };

    document.addEventListener('keydown', listener);
    /** @type {HTMLElement} */ (document.getElementById(id)).dispatchEvent(event);
    document.removeEventListener('keydown', listener);

    return { event, bubbled };
  };

  test('leaves a key pressed in a nested rich text editor alone', () => {
    const { event, bubbled } = press('paragraph', 'a');

    expect(nestedEditor.contains(/** @type {Node} */ (event.target))).toBe(true);
    expect(bubbled).toBe(true);
    expect(event.defaultPrevented).toBe(false);
  });

  test.each(['input', 'button', 'textarea'])('lets the %s control handle a key', (id) => {
    const { event, bubbled } = press(id, 'a');

    expect(bubbled).toBe(false);
    expect(event.defaultPrevented).toBe(false);
  });

  test('keeps a key pressed elsewhere in the block from editing the outer editor', () => {
    const { event, bubbled } = press('label', 'a');

    expect(bubbled).toBe(false);
    expect(event.defaultPrevented).toBe(true);
  });

  test('lets Tab move the focus', () => {
    const { event, bubbled } = press('label', 'Tab');

    expect(bubbled).toBe(false);
    expect(event.defaultPrevented).toBe(false);
  });

  test('removes the block with Backspace pressed on the block itself', () => {
    const { event } = press('wrapper', 'Backspace');

    expect(event.defaultPrevented).toBe(true);
    expect(onRemove).toHaveBeenCalledOnce();
  });

  test('doesn’t remove a read-only block', () => {
    readonly = true;
    press('wrapper', 'Backspace');

    expect(onRemove).not.toHaveBeenCalled();
  });

  test('doesn’t remove the block with Backspace pressed in a control or another key', () => {
    press('input', 'Backspace');
    press('wrapper', 'Delete');

    expect(onRemove).not.toHaveBeenCalled();
  });
});
