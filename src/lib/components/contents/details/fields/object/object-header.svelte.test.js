import { createRawSnippet } from 'svelte';
import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import ObjectHeader from './object-header.svelte';

describe('ObjectHeader', () => {
  test('toggles the expanded state', async () => {
    const toggleExpanded = vi.fn();
    const props = $state({ controlId: 'item-1', expanded: false, toggleExpanded });

    await render(ObjectHeader, props);

    const button = page.getByRole('button', { name: 'Expand' });

    await expect.element(button).toHaveAttribute('aria-expanded', 'false');
    await expect.element(button).toHaveAttribute('aria-controls', 'item-1');

    await button.click();

    expect(props.expanded).toBe(true);
    expect(toggleExpanded).toHaveBeenCalledOnce();
    await expect
      .element(page.getByRole('button', { name: 'Collapse' }))
      .toHaveAttribute('aria-expanded', 'true');
  });

  test('shows the item label and the extra content', async () => {
    const centerContent = createRawSnippet(() => ({
      /**
       * Render the content.
       * @returns {string} HTML.
       */
      render: () => '<span>Summary</span>',
    }));

    const endContent = createRawSnippet(() => ({
      /**
       * Render the content.
       * @returns {string} HTML.
       */
      render: () => '<span>Actions</span>',
    }));

    const { container } = await render(ObjectHeader, {
      label: 'Author',
      controlId: 'item-1',
      expanded: true,
      centerContent,
      endContent,
    });

    expect(container.querySelector('.type')).toHaveTextContent('Author');
    expect(container.querySelector('.center')).toHaveTextContent('Summary');
    expect(container.querySelector('.end')).toHaveTextContent('Actions');
  });
});
