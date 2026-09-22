import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import {
  externalAssets,
  externalFolders,
  renamingExternalSubfolder,
  selectedCloudService,
  selectedExternalDirPath,
} from '$lib/services/assets/external';
import { createMockCloudService, createMockExternalAsset } from '$lib/test/config';

import RenameFolderDialog from './rename-folder-dialog.svelte';

const assets = [
  createMockExternalAsset({ fileName: 'a.png' }),
  createMockExternalAsset({ fileName: 'b.png', folder: 'images/2024' }),
  createMockExternalAsset({ fileName: 'c.png', folder: 'images/2024/summer' }),
];

describe('RenameFolderDialog', () => {
  /** @type {import('vitest').Mock} */
  let move;

  beforeEach(() => {
    move = vi.fn(async (asset, newPath) => ({ ...asset, id: newPath, description: newPath }));
    selectedCloudService.current = createMockCloudService({
      browse: vi.fn(async () => ({ assets, folders: [] })),
      move,
      createFolder: vi.fn(),
      deleteFolder: vi.fn(),
    });
    externalAssets.current = [...assets];
    externalFolders.current = ['images/empty'];
    selectedExternalDirPath.current = 'images';
    renamingExternalSubfolder.current = undefined;
  });

  test('opens for the folder being renamed and moves its files', async () => {
    await render(RenameFolderDialog);

    expect(page.getByRole('dialog').elements()).toHaveLength(0);

    renamingExternalSubfolder.current = { name: '2024', path: 'images/2024' };

    const dialog = page.getByRole('dialog', { name: 'Rename \u20682024\u2069' });

    await expect.element(dialog).toBeInTheDocument();
    // The files are hotlinked, so their URLs change and the entries aren’t updated
    await expect
      .element(dialog)
      .toMatchTextContent(
        'The 2 files in the folder will be moved along, and their URLs will change',
      );
    await expect.element(dialog.getByRole('textbox')).toHaveValue('2024');

    // The name of a sibling folder or file is rejected
    await dialog.getByRole('textbox').fill('empty');
    await expect.element(dialog.getByRole('button', { name: 'Rename' })).toBeDisabled();
    await dialog.getByRole('textbox').fill('a.png');
    await expect.element(dialog.getByRole('button', { name: 'Rename' })).toBeDisabled();

    await dialog.getByRole('textbox').fill('2025');
    await dialog.getByRole('button', { name: 'Rename' }).click();

    await vi.waitFor(() => expect(move).toHaveBeenCalledTimes(2));
    expect(move).toHaveBeenCalledWith(assets[1], 'images/2025/b.png', expect.anything());
    expect(move).toHaveBeenCalledWith(assets[2], 'images/2025/summer/c.png', expect.anything());
    await expect.poll(() => renamingExternalSubfolder.current).toBeUndefined();
  });
});
