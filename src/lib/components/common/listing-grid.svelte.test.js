import { createRawSnippet } from 'svelte';
import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import ListingGrid from './listing-grid.svelte';

describe('ListingGrid', () => {
  test('renders a labelled multi-select grid for the view type', async () => {
    const { container } = await render(ListingGrid, {
      viewType: 'grid',
      'aria-label': 'Assets',
      'aria-rowcount': 3,
      children: createRawSnippet(() => ({
        /**
         * Render the content.
         * @returns {string} HTML.
         */
        render: () => '<div role="row"><div role="gridcell">Item</div></div>',
      })),
    });

    expect(container.querySelector('.grid-view')).not.toBeNull();

    const grid = page.getByRole('grid', { name: 'Assets' });

    await expect.element(grid).toHaveAttribute('aria-multiselectable', 'true');
    await expect.element(grid).toHaveAttribute('aria-rowcount', '3');
    await expect.element(grid.getByRole('row')).toHaveTextContent('Item');
  });

  test('renders empty without content', async () => {
    await render(ListingGrid, { viewType: 'list', 'aria-label': 'Assets' });

    await expect.element(page.getByRole('grid', { name: 'Assets' })).toBeInTheDocument();
    expect(page.getByRole('row').elements()).toHaveLength(0);
  });
});
