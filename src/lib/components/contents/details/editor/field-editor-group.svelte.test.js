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

  test('renders empty without content', async () => {
    const { container } = await render(FieldEditorGroup, {});

    expect(container.querySelector('section')).toBeEmptyDOMElement();
  });
});
