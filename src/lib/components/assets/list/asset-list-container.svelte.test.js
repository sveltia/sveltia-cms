import { createRawSnippet } from 'svelte';
import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import AssetListContainer from './asset-list-container.svelte';

const renderItem = createRawSnippet((/** @type {() => any} */ getItem) => ({
  /**
   * Render the content.
   * @returns {string} HTML.
   */
  render: () => `<div role="row" aria-label="${getItem().name}"></div>`,
}));

const emptyAction = createRawSnippet(() => ({
  /**
   * Render the content.
   * @returns {string} HTML.
   */
  render: () => '<button type="button">Upload</button>',
}));

/** @type {any} */
const groups = {
  '*': [{ name: 'a.png' }, { name: 'b.png' }],
};

describe('AssetListContainer', () => {
  test('lists the assets in a grid', async () => {
    await render(AssetListContainer, {
      groups,
      itemKey: 'name',
      totalCount: 2,
      viewType: 'grid',
      uploadDisabled: false,
      onDrop: vi.fn(),
      renderItem,
    });

    const grid = page.getByRole('grid', { name: 'Assets' });

    await expect.element(grid).toHaveAttribute('aria-rowcount', '2');
    await expect.element(grid.getByRole('row', { name: 'b.png' })).toBeInTheDocument();
    expect(page.getByRole('rowgroup').elements()).toHaveLength(1);
  });

  test('labels each group', async () => {
    await render(AssetListContainer, {
      groups: /** @type {any} */ ({ images: [{ name: 'a.png' }], docs: [{ name: 'b.pdf' }] }),
      itemKey: 'name',
      totalCount: 2,
      viewType: 'list',
      uploadDisabled: false,
      onDrop: vi.fn(),
      renderItem,
    });

    await expect.element(page.getByRole('rowgroup', { name: 'docs' })).toBeInTheDocument();
    expect(page.getByRole('rowgroup').elements()).toHaveLength(2);
  });

  test('shows an empty state with an upload action', async () => {
    await render(AssetListContainer, {
      groups: { '*': [] },
      itemKey: 'name',
      totalCount: 0,
      viewType: 'grid',
      uploadDisabled: false,
      onDrop: vi.fn(),
      renderItem,
      emptyAction,
    });

    expect(page.getByRole('grid').elements()).toHaveLength(0);
    await expect.element(page.getByText('No files found.')).toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: 'Upload' })).toBeInTheDocument();
  });

  test('hides the upload action when uploading is disabled', async () => {
    await render(AssetListContainer, {
      groups: {},
      itemKey: 'name',
      totalCount: 0,
      viewType: 'grid',
      uploadDisabled: true,
      onDrop: vi.fn(),
      renderItem,
      emptyAction,
    });

    await expect.element(page.getByText('No files found.')).toBeInTheDocument();
    expect(page.getByRole('button').elements()).toHaveLength(0);
  });

  test('shows an empty state without an upload action', async () => {
    await render(AssetListContainer, {
      groups: { '*': [] },
      itemKey: 'name',
      totalCount: 0,
      viewType: 'grid',
      uploadDisabled: false,
      onDrop: vi.fn(),
      renderItem,
    });

    await expect.element(page.getByText('No files found.')).toBeInTheDocument();
    expect(page.getByRole('button').elements()).toHaveLength(0);
  });
});
