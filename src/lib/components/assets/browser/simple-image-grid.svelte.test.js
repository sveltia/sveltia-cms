import { sleep } from '@sveltia/utils/misc';
import { createRawSnippet } from 'svelte';
import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import SimpleImageGrid from './simple-image-grid.svelte';

const children = createRawSnippet(() => ({
  /**
   * Render the content.
   * @returns {string} HTML.
   */
  render: () =>
    '<div><div role="option" aria-selected="false">One</div><div role="option" aria-selected="false">Two</div></div>',
}));

describe('SimpleImageGrid', () => {
  test('renders a list box with the items', async () => {
    const onChange = vi.fn();
    const { container } = await render(SimpleImageGrid, { gridId: 'grid', children, onChange });
    const listbox = page.getByRole('listbox', { name: 'Available Images' });

    await expect.element(listbox).toHaveAttribute('id', 'grid');
    expect(container.querySelector('[role="listbox"].grid')).not.toBeNull();
    expect(listbox.getByRole('option').elements()).toHaveLength(2);
  });

  test('applies the view type and allows multiple selection', async () => {
    const { container } = await render(SimpleImageGrid, {
      viewType: 'list',
      multiple: true,
      children,
    });

    const listbox = /** @type {HTMLElement} */ (container.querySelector('[role="listbox"]'));

    expect(listbox).toHaveClass('list');
    expect(listbox).toHaveAttribute('aria-multiselectable', 'true');
  });

  test('reports a selection change', async () => {
    const onChange = vi.fn();

    await render(SimpleImageGrid, { children, onChange });
    // A Sveltia UI list box starts handling clicks 100 ms after it’s mounted
    await sleep(150);
    await page.getByRole('option', { name: 'Two' }).click();

    await vi.waitFor(() => expect(onChange).toHaveBeenCalled());
  });

  test('renders an empty grid without content', async () => {
    const { container } = await render(SimpleImageGrid, {});

    expect(container.querySelector('[role="listbox"]')).toBeInTheDocument();
    expect(container.querySelectorAll('[role="option"]')).toHaveLength(0);
  });
});
