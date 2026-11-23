import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import {
  deletingExternalSubfolder,
  externalAssets,
  externalFolders,
  selectedCloudService,
} from '$lib/services/assets/external';
import { createMockCloudService, createMockExternalAsset } from '$lib/test/config';

import DeleteFolderDialog from './delete-folder-dialog.svelte';

const assets = [
  createMockExternalAsset({ fileName: 'a.png' }),
  createMockExternalAsset({ fileName: 'b.png', folder: 'images/2024' }),
];

describe('DeleteFolderDialog', () => {
  /** @type {import('vitest').Mock} */
  let deleteAssets;
  /** @type {import('vitest').Mock} */
  let deleteFolder;

  beforeEach(() => {
    deleteAssets = vi.fn().mockResolvedValue(undefined);
    deleteFolder = vi.fn().mockResolvedValue(undefined);
    selectedCloudService.current = createMockCloudService({
      browse: vi.fn(),
      delete: deleteAssets,
      deleteFolder,
    });
    externalAssets.current = [...assets];
    externalFolders.current = ['images/2024/empty'];
    deletingExternalSubfolder.current = undefined;
  });

  test('opens for the folder being deleted and removes its files and placeholders', async () => {
    await render(DeleteFolderDialog);

    expect(page.getByRole('alertdialog').elements()).toHaveLength(0);

    deletingExternalSubfolder.current = { name: '2024', path: 'images/2024' };

    const dialog = page.getByRole('alertdialog', { name: 'Delete Folder' });

    await expect
      .element(dialog)
      .toMatchTextContent('delete the “\u20682024\u2069” folder and the asset in it?');
    await dialog.getByRole('button', { name: 'Delete' }).click();

    await vi.waitFor(() =>
      expect(deleteAssets).toHaveBeenCalledWith([assets[1]], expect.anything()),
    );
    expect(deleteFolder).toHaveBeenCalledWith('images/2024/empty', expect.anything());
    await expect.poll(() => externalAssets.current).toEqual([assets[0]]);
    await expect.poll(() => externalFolders.current).toEqual([]);
    await expect.poll(() => deletingExternalSubfolder.current).toBeUndefined();
  });

  test('lets go of the folder when cancelled', async () => {
    await render(DeleteFolderDialog);

    deletingExternalSubfolder.current = { name: '2024', path: 'images/2024' };

    const dialog = page.getByRole('alertdialog', { name: 'Delete Folder' });

    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect.poll(() => deletingExternalSubfolder.current).toBeUndefined();
    expect(deleteAssets).not.toHaveBeenCalled();
  });
});
