import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import AssetUpdatesToast from '$lib/components/assets/shared/asset-updates-toast.svelte';
import { deleteAssets } from '$lib/services/assets/data/delete';
import { lockedBranch } from '$lib/services/backends/branch-access';
import { createMockAsset, initTestConfig, setAssets } from '$lib/test/config';
import { waitForToastsToHide } from '$lib/test/toast';

import DeleteAssetsButton from './delete-assets-button.svelte';

vi.mock('$lib/services/assets/data/delete', () => ({
  updateStores: vi.fn(),
  deleteAssets: vi.fn(),
}));

const assets = [createMockAsset({ name: 'a.png' }), createMockAsset({ name: 'b.png' })];

describe('DeleteAssetsButton (repository)', () => {
  beforeAll(async () => {
    await initTestConfig();
    setAssets(assets);
  });

  beforeEach(() => {
    lockedBranch.current = undefined;
  });

  test('commits the deletion of the asset shown, then calls back', async () => {
    const onDelete = vi.fn();

    vi.mocked(deleteAssets).mockResolvedValueOnce(undefined);
    await render(DeleteAssetsButton, { assets: [assets[0]], onDelete, useButton: false });
    await page.getByRole('menuitem', { name: 'Delete Asset' }).click();

    const dialog = page.getByRole('alertdialog', { name: 'Delete Asset' });

    await expect.element(dialog).toMatchTextContent('Are you sure you want to delete this asset?');
    await dialog.getByRole('button', { name: 'Delete' }).click();
    await vi.waitFor(() => expect(deleteAssets).toHaveBeenCalledWith([assets[0]]));
    await vi.waitFor(() => expect(onDelete).toHaveBeenCalledOnce());
  });

  test('reports a failure to delete the selected assets', async () => {
    // The toasts reporting the commit are rendered by the shared component
    await render(AssetUpdatesToast, {});

    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onDelete = vi.fn();

    vi.mocked(deleteAssets).mockRejectedValueOnce(new Error('offline'));

    try {
      await render(DeleteAssetsButton, { assets, listedCount: 3, onDelete });
      await page.getByRole('button', { name: 'Delete Selected Assets' }).click();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
      await vi.waitFor(() => expect(deleteAssets).toHaveBeenCalledWith(assets));
      await expect
        .poll(() =>
          document
            .querySelector('.sui.toast:not([aria-hidden="true"]) .sui.alert.error')
            ?.textContent?.replace(/\s+/g, ' ')
            .trim(),
        )
        .toBe('error Error Delete failed.');
      expect(onDelete).not.toHaveBeenCalled();
      await waitForToastsToHide();
    } finally {
      error.mockRestore();
    }
  }, 15000);

  test('is disabled without assets', async () => {
    await render(DeleteAssetsButton, {});
    await expect
      .element(page.getByRole('button', { name: 'Delete Asset' }))
      .toHaveAttribute('aria-disabled', 'true');
  });

  test('is disabled while the user can’t push to the branch', async () => {
    lockedBranch.current = 'main';
    await render(DeleteAssetsButton, { assets });
    await expect
      .element(page.getByRole('button', { name: 'Delete Asset' }))
      .toHaveAttribute('aria-disabled', 'true');
  });
});
