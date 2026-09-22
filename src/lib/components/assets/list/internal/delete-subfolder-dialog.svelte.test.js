import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { deleteSubfolder } from '$lib/services/assets/data/subfolder';
import { globalAssetFolder, selectedAssetFolder } from '$lib/services/assets/folders';
import { deletingSubfolder } from '$lib/services/assets/subfolders';
import {
  createMockAsset,
  createMockEntry,
  initTestConfig,
  setAssets,
  setEntries,
} from '$lib/test/config';
import { waitForToastsToHide } from '$lib/test/toast';

import DeleteSubfolderDialog from './delete-subfolder-dialog.svelte';

vi.mock('$lib/services/assets/data/subfolder', async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  deleteSubfolder: vi.fn(),
}));

describe('DeleteSubfolderDialog', () => {
  beforeAll(async () => {
    await initTestConfig({
      collections: [
        {
          name: 'posts',
          label: 'Posts',
          folder: 'content/posts',
          fields: [
            { name: 'title', widget: 'string' },
            { name: 'cover', widget: 'image', required: true },
          ],
        },
      ],
    });

    const folder = globalAssetFolder.current;

    setAssets([
      createMockAsset({ name: 'a.png', asset: { folder } }),
      createMockAsset({ name: 'b.png', folderPath: 'static/uploads/2024', asset: { folder } }),
      createMockAsset({
        name: 'c.png',
        folderPath: 'static/uploads/2024/summer',
        asset: { folder },
      }),
      createMockAsset({ name: 'd.png', folderPath: 'static/uploads/2023', asset: { folder } }),
    ]);
    setEntries([
      // The cover is required, so the asset it holds can’t be deleted
      createMockEntry({
        slug: 'hello',
        content: { _default: { title: 'Hello', cover: '/static/uploads/2023/d.png' } },
      }),
    ]);
  });

  beforeEach(() => {
    selectedAssetFolder.current = globalAssetFolder.current;
    deletingSubfolder.current = undefined;
  });

  test('confirms the deletion of the folder and the assets in it', async () => {
    vi.mocked(deleteSubfolder).mockResolvedValue(undefined);

    await render(DeleteSubfolderDialog);
    expect(page.getByRole('alertdialog').elements()).toHaveLength(0);

    deletingSubfolder.current = { name: '2024', path: 'static/uploads/2024' };

    const dialog = page.getByRole('alertdialog', { name: 'Delete Folder' });

    await expect
      .element(
        dialog.getByText(
          'Are you sure you want to delete the “\u20682024\u2069” folder and the 2 assets in it?',
        ),
      )
      .toBeVisible();
    await expect.element(dialog.getByRole('button', { name: 'Delete' })).toBeEnabled();
    await dialog.getByRole('button', { name: 'Delete' }).click();

    await vi.waitFor(() => expect(deleteSubfolder).toHaveBeenCalledWith('static/uploads/2024'));
    await expect.poll(() => deletingSubfolder.current).toBeUndefined();
  });

  test('confirms the deletion of an empty folder', async () => {
    deletingSubfolder.current = { name: 'empty', path: 'static/uploads/empty' };

    await render(DeleteSubfolderDialog);

    const dialog = page.getByRole('alertdialog', { name: 'Delete Folder' });

    await expect
      .element(
        dialog.getByText('Are you sure you want to delete the empty “\u2068empty\u2069” folder?'),
      )
      .toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();

    await expect.poll(() => deletingSubfolder.current).toBeUndefined();
    expect(deleteSubfolder).not.toHaveBeenCalled();
  });

  test('refuses to delete a folder holding an asset an entry requires', async () => {
    deletingSubfolder.current = { name: '2023', path: 'static/uploads/2023' };

    await render(DeleteSubfolderDialog);

    const dialog = page.getByRole('alertdialog', { name: 'Delete Folder' });

    await expect.element(dialog.getByRole('alert')).toBeVisible();
    await expect.element(dialog.getByRole('button', { name: 'Delete' })).toBeDisabled();
    expect(dialog.getByText(/Are you sure/).elements()).toHaveLength(0);
  });

  test('reports a failure to delete the folder', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.mocked(deleteSubfolder).mockRejectedValue(new Error('offline'));
    deletingSubfolder.current = { name: 'empty', path: 'static/uploads/empty' };

    try {
      await render(DeleteSubfolderDialog);

      const dialog = page.getByRole('alertdialog', { name: 'Delete Folder' });

      await dialog.getByRole('button', { name: 'Delete' }).click();

      await vi.waitFor(() => expect(deleteSubfolder).toHaveBeenCalledOnce());
      await expect
        .poll(() =>
          document
            .querySelector('.sui.toast:not([aria-hidden="true"]) .sui.alert.error')
            ?.textContent?.replace(/\s+/g, ' ')
            .trim(),
        )
        .toBe('error Error Couldn’t delete the folder.');
      await waitForToastsToHide();
    } finally {
      error.mockRestore();
    }
  }, 15000);
});
