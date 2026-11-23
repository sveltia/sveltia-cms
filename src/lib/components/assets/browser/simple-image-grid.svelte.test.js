import { createRawSnippet } from 'svelte';
import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import SimpleImageGrid from './simple-image-grid.svelte';

const items = [
  { id: '1', name: 'One' },
  { id: '2', name: 'Two' },
];

const renderItem = createRawSnippet((/** @type {() => { name: string }} */ getItem) => ({
  /**
   * Render an item.
   * @returns {string} HTML.
   */
  render: () => `<div role="option" aria-selected="false">${getItem().name}</div>`,
}));

/** @type {any[]} */
const subfolders = [{ name: '2024', path: 'uploads/2024' }];

describe('SimpleImageGrid', () => {
  test('renders a list box with the items', async () => {
    const { container } = await render(SimpleImageGrid, {
      gridId: 'grid',
      kind: 'image',
      items,
      itemKey: 'id',
      renderItem,
    });

    const listbox = page.getByRole('listbox', { name: 'Available Images' });

    await expect.element(listbox).toHaveAttribute('id', 'grid');
    expect(container.querySelector('[role="listbox"].grid')).not.toBeNull();
    await expect.poll(() => listbox.getByRole('option').elements()).toHaveLength(2);
    // No subfolders
    expect(page.getByRole('listbox', { name: 'Folders' }).elements()).toHaveLength(0);
  });

  test('is named after files of any kind by default', async () => {
    await render(SimpleImageGrid, { items, itemKey: 'id', renderItem });

    await expect.element(page.getByRole('listbox', { name: 'Available Files' })).toBeVisible();
  });

  test('applies the view type and allows multiple selection', async () => {
    const { container } = await render(SimpleImageGrid, {
      viewType: 'list',
      multiple: true,
      items,
      itemKey: 'id',
      renderItem,
    });

    const listbox = /** @type {HTMLElement} */ (container.querySelector('[role="listbox"]'));

    expect(listbox).toHaveClass('list');
    expect(listbox).toHaveAttribute('aria-multiselectable', 'true');
  });

  test('lists the subfolders ahead of the assets, and leaves out an empty list box', async () => {
    const onOpenSubfolder = vi.fn();

    const { container } = await render(SimpleImageGrid, {
      subfolders,
      onOpenSubfolder,
      items: [],
      itemKey: 'id',
      renderItem,
    });

    await page.getByRole('option', { name: '2024' }).click();
    await vi.waitFor(() => expect(onOpenSubfolder).toHaveBeenCalledWith(subfolders[0]));
    expect(container.querySelectorAll('[role="listbox"]')).toHaveLength(1);
  });

  test('lets the subfolders be selected', async () => {
    const onSelectSubfolder = vi.fn();

    await render(SimpleImageGrid, {
      subfolders,
      selectedSubfolderPaths: ['uploads/2024'],
      onSelectSubfolder,
      items,
      itemKey: 'id',
      renderItem,
    });

    await expect
      .element(page.getByRole('option', { name: '2024' }))
      .toHaveAttribute('aria-selected', 'true');
  });
});
