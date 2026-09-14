import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { createMockAsset } from '$lib/test/config';

import DeleteAssetsButton from './delete-assets-button.svelte';

const assets = [createMockAsset({ name: 'a.png' }), createMockAsset({ name: 'b.png' })];

describe('DeleteAssetsButton', () => {
  test('asks for confirmation, then deletes the assets', async () => {
    const deleteAssets = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn();

    await render(DeleteAssetsButton, {
      assets,
      deleteAssets,
      onDelete,
      buttonDescription: 'Delete Selected Assets',
      dialogDescription: 'Are you sure?',
    });

    await page.getByRole('button', { name: 'Delete Selected Assets' }).click();

    const dialog = page.getByRole('alertdialog', { name: 'Delete Assets' });

    await expect.element(dialog).toHaveTextContent('Delete Assets Are you sure? Delete Cancel');
    await dialog.getByRole('button', { name: 'Delete' }).click();

    await vi.waitFor(() => expect(deleteAssets).toHaveBeenCalledWith(assets));
    await vi.waitFor(() => expect(onDelete).toHaveBeenCalledOnce());
  });

  test('skips the callback when the deletion is refused', async () => {
    const deleteAssets = vi.fn().mockResolvedValue(false);
    const onDelete = vi.fn();

    await render(DeleteAssetsButton, { assets: [assets[0]], deleteAssets, onDelete });

    await page.getByRole('button', { name: 'Delete' }).click();
    await page
      .getByRole('alertdialog', { name: 'Delete Asset' })
      .getByRole('button', { name: 'Delete' })
      .click();

    await vi.waitFor(() => expect(deleteAssets).toHaveBeenCalledOnce());
    expect(onDelete).not.toHaveBeenCalled();
  });

  test('is disabled without assets, and can be a menu item', async () => {
    await render(DeleteAssetsButton, { deleteAssets: vi.fn() });
    await expect.element(page.getByRole('button')).toHaveAttribute('aria-disabled', 'true');

    await render(DeleteAssetsButton, { assets, deleteAssets: vi.fn(), useButton: false });
    await expect.element(page.getByRole('menuitem', { name: 'Delete' })).toBeVisible();
  });
});
