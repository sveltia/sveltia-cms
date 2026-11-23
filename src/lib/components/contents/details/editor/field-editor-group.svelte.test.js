import { createRawSnippet } from 'svelte';
import { describe, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';

import FieldEditorGroup from './field-editor-group.svelte';

const children = createRawSnippet(() => ({
  /**
   * Render the content.
   * @returns {string} HTML.
   */
  render: () => '<p>Field</p>',
}));

describe('FieldEditorGroup', () => {
  test('renders a labelled group with any extra attributes', async () => {
    const { container } = await render(FieldEditorGroup, {
      'aria-label': 'Title Field',
      'data-key-path': 'title',
      children,
    });

    const section = container.querySelector('section');

    expect(section).toHaveAttribute('role', 'group');
    expect(section).toHaveAttribute('aria-label', 'Title Field');
    expect(section).toHaveAttribute('data-key-path', 'title');
    expect(section).toHaveTextContent('Field');
  });

  test('announces its removal to the group members', async () => {
    const { container, unmount } = await render(FieldEditorGroup, { children });
    const listener = vi.fn();

    container.querySelector('section')?.addEventListener('Unmount', listener);
    await unmount();

    expect(listener).toHaveBeenCalledOnce();
  });

  test('hides the header buttons until hovered, but not while the field has focus', async () => {
    const { container } = await render(FieldEditorGroup, {
      children: createRawSnippet(() => ({
        /**
         * Render the content.
         * @returns {string} HTML.
         */
        render: () => '<header><button>Copy</button><input /></header>',
      })),
    });

    // Without hover, there’s no rule hiding the buttons for the test to check
    expect(matchMedia('(hover: hover)').matches).toBe(true);

    const button = /** @type {HTMLButtonElement} */ (container.querySelector('button'));
    const input = /** @type {HTMLInputElement} */ (container.querySelector('input'));
    /**
     * Get the opacity of the button.
     * @returns {string} Opacity.
     */
    const getOpacity = () => getComputedStyle(button).opacity;

    expect(getOpacity()).toBe('0');
    button.focus();
    expect(getOpacity()).toBe('1');
    input.focus();
    expect(getOpacity()).toBe('1');
    input.blur();
    expect(getOpacity()).toBe('0');
  });

  test('renders empty without content', async () => {
    const { container } = await render(FieldEditorGroup, {});

    expect(container.querySelector('section')).toBeEmptyDOMElement();
  });
});
