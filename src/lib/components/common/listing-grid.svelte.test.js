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

  test('keeps the space for a thumbnail that isn’t there in the grid view', async () => {
    const { container } = await render(ListingGrid, {
      viewType: 'grid',
      'aria-label': 'Entries',
      children: createRawSnippet(() => ({
        /**
         * Render two tiles: one whose thumbnail hasn’t loaded, which only holds the thumbnail’s
         * hidden anchor, and one with a short thumbnail.
         * @returns {string} HTML.
         */
        render: () => `
          <div role="rowgroup" class="grid-body">
            <div role="row" class="grid-row">
              <div role="gridcell" class="grid-cell image"><span hidden></span></div>
            </div>
            <div role="row" class="grid-row">
              <div role="gridcell" class="grid-cell image">
                <span hidden></span><div style="height: 10px"></div>
              </div>
            </div>
          </div>
        `,
      })),
    });

    await expect.element(page.getByRole('grid', { name: 'Entries' })).toBeInTheDocument();

    const [empty, filled] = [...container.querySelectorAll('.image')].map((cell) =>
      cell.getBoundingClientRect(),
    );

    expect(empty.width).toBeGreaterThan(0);
    expect(empty.height).toBe(empty.width);
    // A thumbnail takes its own size
    expect(filled.height).toBe(10);
  });

  test('renders empty without content', async () => {
    await render(ListingGrid, { viewType: 'list', 'aria-label': 'Assets' });

    await expect.element(page.getByRole('grid', { name: 'Assets' })).toBeInTheDocument();
    expect(page.getByRole('row').elements()).toHaveLength(0);
  });
});
