import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { env } from '$lib/services/user/env.svelte';

import AssetListItem from './asset-list-item.svelte';

/**
 * Render the item.
 * @param {Record<string, any>} [props] Props to override.
 * @returns {Promise<Record<string, any>>} Handlers.
 */
const renderItem = async (props = {}) => {
  const handlers = {
    onSelectionChange: vi.fn(),
    onFocus: vi.fn(),
    onPreview: vi.fn(),
  };

  await render(AssetListItem, {
    name: 'photo.png',
    kind: 'image',
    src: 'https://example.com/photo.png',
    rowIndex: 3,
    viewType: 'grid',
    selected: false,
    canPreview: true,
    ...handlers,
    ...props,
  });

  return handlers;
};

describe('AssetListItem', () => {
  beforeEach(() => {
    env.isSmallScreen = false;
    env.isMediumScreen = false;
    env.hasMouse = true;
  });

  test('shows the preview, name and a checkbox', async () => {
    const { onSelectionChange } = await renderItem();
    const row = page.getByRole('row', { name: 'photo.png' });

    await expect.element(row).toHaveAttribute('aria-rowindex', '4');
    await expect.element(row.getByRole('img', { name: 'photo.png' })).toBeInTheDocument();
    await expect.element(row.getByText('photo.png')).toBeInTheDocument();

    await row.getByRole('checkbox').click({ force: true });
    expect(onSelectionChange).toHaveBeenCalledWith(true);

    // The grid reports a selection change made with the keyboard on the row itself
    row.element().dispatchEvent(new CustomEvent('Change', { detail: { selected: false } }));
    expect(onSelectionChange).toHaveBeenLastCalledWith(false);
  });

  test('opens the preview on double click with a mouse', async () => {
    const { onPreview } = await renderItem();
    const row = page.getByRole('row');

    await row.click();
    expect(onPreview).not.toHaveBeenCalled();

    await row.dblClick();
    expect(onPreview).toHaveBeenCalledOnce();
  });

  test('opens the preview on a single tap on a touch device', async () => {
    env.hasMouse = false;

    const { onPreview } = await renderItem();

    await page.getByRole('row').click();
    expect(onPreview).toHaveBeenCalledOnce();
  });

  test('never opens the preview when it’s not available', async () => {
    const { onPreview } = await renderItem({ canPreview: false });

    await page.getByRole('row').dblClick();
    expect(onPreview).not.toHaveBeenCalled();
  });

  test('drops the checkbox and the name on a small screen', async () => {
    env.isSmallScreen = true;

    await renderItem();

    expect(page.getByRole('checkbox').elements()).toHaveLength(0);
    expect(page.getByText('photo.png').elements()).toHaveLength(0);
  });

  test('keeps the name in the list view on a small screen', async () => {
    env.isSmallScreen = true;

    await renderItem({ viewType: 'list' });
    await expect.element(page.getByText('photo.png')).toBeInTheDocument();
  });
});
