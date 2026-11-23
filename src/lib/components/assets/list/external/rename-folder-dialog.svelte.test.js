import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import {
  externalAssets,
  externalFolders,
  renamingExternalSubfolder,
  selectedCloudService,
  selectedExternalDirPath,
} from '$lib/services/assets/external';
import { getExternalAssetsUsedEntries } from '$lib/services/assets/external/details';
import { lockedBranch } from '$lib/services/backends/branch-access';
import { isEntryReadonly } from '$lib/services/contents/entry/readonly';
import { createMockCloudService, createMockExternalAsset } from '$lib/test/config';

import RenameFolderDialog from './rename-folder-dialog.svelte';

vi.mock('$lib/services/assets/external/details', async (importOriginal) => ({
  .../** @type {any} */ (await importOriginal()),
  getExternalAssetsUsedEntries: vi.fn(async () => []),
}));

// The blocked message is worked out by the real functions, with the mocked read-only checks below
vi.mock('$lib/services/contents/entry/readonly', () => ({
  isEntryReadonly: vi.fn(() => false),
  getReadonlyEntryLabel: vi.fn((entry) => `Archive › ${entry.slug}`),
}));

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
    vi.mocked(getExternalAssetsUsedEntries).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.mocked(isEntryReadonly).mockReturnValue(false);
    lockedBranch.current = undefined;
  });

  test('opens for the folder being renamed and moves its files', async () => {
    await render(RenameFolderDialog);

    expect(page.getByRole('dialog').elements()).toHaveLength(0);

    renamingExternalSubfolder.current = { name: '2024', path: 'images/2024' };

    const dialog = page.getByRole('dialog', { name: 'Rename \u20682024\u2069' });

    await expect.element(dialog).toBeInTheDocument();
    // The files are moved along, and the entries using them are updated
    await expect
      .element(dialog)
      .toMatchTextContent(
        'Enter a new name below. The 2 assets in the folder will be moved along, and ' +
          'any entries using them will be updated.',
      );
    await expect.element(dialog.getByRole('textbox')).toHaveValue('2024');
    expect(dialog.getByRole('alert').elements()).toHaveLength(0);

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

  test('refuses to rename a folder with a file a read-only entry uses', async () => {
    const entry = /** @type {any} */ ({ id: 'old', slug: 'old-post' });

    vi.mocked(getExternalAssetsUsedEntries).mockResolvedValue([entry]);
    vi.mocked(isEntryReadonly).mockReturnValue(true);

    await render(RenameFolderDialog);

    renamingExternalSubfolder.current = { name: '2024', path: 'images/2024' };

    const dialog = page.getByRole('dialog', { name: 'Rename \u20682024\u2069' });

    await expect
      .element(dialog.getByRole('alert'))
      .toHaveTextContent(
        'This asset can’t be moved or renamed, because the following read-only entries use it: ' +
          '\u2068Archive › old-post\u2069.',
      );
    // The entries are looked up for every file in the folder, at any depth
    expect(getExternalAssetsUsedEntries).toHaveBeenCalledWith([assets[1], assets[2]]);
    await expect.element(dialog.getByRole('textbox')).toBeDisabled();
    await expect.element(dialog.getByRole('button', { name: 'Rename' })).toBeDisabled();
  });

  test('refuses to rename a folder with files entries use while the media library is locked', async () => {
    lockedBranch.current = 'main';
    vi.mocked(getExternalAssetsUsedEntries).mockResolvedValue(/** @type {any[]} */ ([{}]));

    await render(RenameFolderDialog);

    renamingExternalSubfolder.current = { name: '2024', path: 'images/2024' };

    const dialog = page.getByRole('dialog', { name: 'Rename \u20682024\u2069' });

    await expect
      .element(dialog.getByRole('alert'))
      .toHaveTextContent(
        'These files can’t be renamed or moved, because the entries using them can’t be updated.',
      );
    await expect.element(dialog.getByRole('textbox')).toBeDisabled();
    await expect.element(dialog.getByRole('button', { name: 'Rename' })).toBeDisabled();
  });

  test('renames a folder no entry uses while the media library is locked', async () => {
    lockedBranch.current = 'main';

    await render(RenameFolderDialog);

    renamingExternalSubfolder.current = { name: '2024', path: 'images/2024' };

    const dialog = page.getByRole('dialog', { name: 'Rename \u20682024\u2069' });

    await vi.waitFor(() =>
      expect(getExternalAssetsUsedEntries).toHaveBeenCalledWith([assets[1], assets[2]]),
    );
    await expect.element(dialog.getByRole('textbox')).toHaveValue('2024');
    expect(dialog.getByRole('alert').elements()).toHaveLength(0);
    await dialog.getByRole('textbox').fill('2025');
    await dialog.getByRole('button', { name: 'Rename' }).click();
    await vi.waitFor(() => expect(move).toHaveBeenCalledTimes(2));
  });

  test('ignores the entries of a folder no longer being renamed', async () => {
    /**
     * Resolve the pending lookup of the entries.
     * @type {(entries: any[]) => void}
     */
    let resolve = () => {};

    await render(RenameFolderDialog);

    vi.mocked(getExternalAssetsUsedEntries).mockReturnValueOnce(
      new Promise((r) => {
        resolve = r;
      }),
    );
    // The entries found late would block the rename, if they were taken
    vi.mocked(isEntryReadonly).mockReturnValue(true);
    renamingExternalSubfolder.current = { name: '2024', path: 'images/2024' };
    await vi.waitFor(() =>
      expect(getExternalAssetsUsedEntries).toHaveBeenCalledWith([assets[1], assets[2]]),
    );
    renamingExternalSubfolder.current = { name: 'summer', path: 'images/2024/summer' };
    await vi.waitFor(() => expect(getExternalAssetsUsedEntries).toHaveBeenCalledWith([assets[2]]));
    resolve([{ slug: 'old-post' }]);
    await new Promise((r) => {
      setTimeout(r, 50);
    });

    expect(page.getByRole('alert').elements()).toHaveLength(0);
  });
});
