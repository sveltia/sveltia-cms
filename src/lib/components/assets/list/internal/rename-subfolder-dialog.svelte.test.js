import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { renameSubfolder } from '$lib/services/assets/data/subfolder';
import { globalAssetFolder, selectedAssetFolder } from '$lib/services/assets/folders';
import { renamingSubfolder, selectedSubfolderPath } from '$lib/services/assets/subfolders';
import { createMockAsset, initTestConfig, setAssets } from '$lib/test/config';
import { waitForToastsToHide } from '$lib/test/toast';

import RenameSubfolderDialog from './rename-subfolder-dialog.svelte';

vi.mock('$lib/services/assets/data/subfolder', async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  renameSubfolder: vi.fn(),
}));

const subfolder = { name: '2024', path: 'static/uploads/2024' };

describe('RenameSubfolderDialog', () => {
  beforeAll(async () => {
    await initTestConfig();

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
  });

  beforeEach(() => {
    selectedAssetFolder.current = globalAssetFolder.current;
    selectedSubfolderPath.current = '';
    renamingSubfolder.current = undefined;
  });

  test('opens for the folder being renamed and renames it', async () => {
    vi.mocked(renameSubfolder).mockResolvedValue(undefined);

    await render(RenameSubfolderDialog);
    expect(page.getByRole('dialog').elements()).toHaveLength(0);

    renamingSubfolder.current = subfolder;

    const dialog = page.getByRole('dialog', { name: 'Rename \u20682024\u2069' });
    const textbox = dialog.getByRole('textbox', { name: 'Folder Name' });
    const rename = dialog.getByRole('button', { name: 'Rename' });

    // The assets in the folder, at any depth, are moved along
    await expect
      .element(
        dialog.getByText(
          'Enter a new name below. The 2 assets in the folder will be moved along, and any ' +
            'entries using them will be updated.',
        ),
      )
      .toBeVisible();
    await expect.element(textbox).toHaveValue('2024');
    // Nothing to rename until the name changes
    await expect.element(rename).toBeDisabled();

    // The names of the siblings are taken, but the folder’s own isn’t
    await textbox.fill('2023');
    await expect
      .element(dialog.getByText('A folder or file with this name already exists here.'))
      .toBeVisible();
    await textbox.fill('a.png');
    await expect.element(rename).toBeDisabled();

    await textbox.fill('2025');
    await expect.element(rename).toBeEnabled();
    await rename.click();

    await vi.waitFor(() =>
      expect(renameSubfolder).toHaveBeenCalledWith({
        dirPath: 'static/uploads/2024',
        newDirPath: 'static/uploads/2025',
      }),
    );
    await expect.poll(() => renamingSubfolder.current).toBeUndefined();
  });

  test('lets go of the folder when cancelled', async () => {
    renamingSubfolder.current = { name: '2023', path: 'static/uploads/2023' };

    await render(RenameSubfolderDialog);

    const dialog = page.getByRole('dialog', { name: 'Rename \u20682023\u2069' });

    await expect
      .element(
        dialog.getByText(
          'Enter a new name below. The asset in the folder will be moved along, and any entry ' +
            'using it will be updated.',
        ),
      )
      .toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();

    await expect.poll(() => renamingSubfolder.current).toBeUndefined();
    expect(renameSubfolder).not.toHaveBeenCalled();
  });

  test('reports a failure to rename the folder', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.mocked(renameSubfolder).mockRejectedValue(new Error('offline'));
    renamingSubfolder.current = { name: 'empty', path: 'static/uploads/empty' };

    try {
      await render(RenameSubfolderDialog);

      const dialog = page.getByRole('dialog', { name: 'Rename \u2068empty\u2069' });

      await expect.element(dialog.getByText('Enter a new name below.')).toBeVisible();
      await dialog.getByRole('textbox', { name: 'Folder Name' }).fill('void');
      await dialog.getByRole('button', { name: 'Rename' }).click();

      await vi.waitFor(() => expect(renameSubfolder).toHaveBeenCalledOnce());
      await expect
        .poll(() =>
          document
            .querySelector('.sui.toast:not([aria-hidden="true"]) .sui.alert.error')
            ?.textContent?.replace(/\s+/g, ' ')
            .trim(),
        )
        .toBe('error Error Couldn’t rename the folder.');
      await waitForToastsToHide();
    } finally {
      error.mockRestore();
    }
  }, 15000);
});
