import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { createSubfolder } from '$lib/services/assets/data/subfolder';
import { globalAssetFolder, selectedAssetFolder } from '$lib/services/assets/folders';
import { selectedSubfolderPath } from '$lib/services/assets/subfolders';
import { showNewSubfolderDialog } from '$lib/services/assets/view';
import { createMockAsset, initTestConfig, setAssets } from '$lib/test/config';
import { waitForToastsToHide } from '$lib/test/toast';

import NewFolderDialog from './new-folder-dialog.svelte';

vi.mock('$lib/services/assets/data/subfolder', () => ({
  GITKEEP_FILE_NAME: '.gitkeep',
  createSubfolder: vi.fn(),
}));

describe('NewFolderDialog', () => {
  beforeAll(async () => {
    await initTestConfig();
    setAssets([
      createMockAsset({ name: 'a.png', asset: { folder: globalAssetFolder.current } }),
      // In a subfolder of the global folder
      createMockAsset({
        name: 'b.png',
        folderPath: 'static/uploads/2024',
        asset: { folder: globalAssetFolder.current },
      }),
    ]);
  });

  beforeEach(() => {
    selectedAssetFolder.current = globalAssetFolder.current;
    selectedSubfolderPath.current = '';
    showNewSubfolderDialog.current = false;
    window.location.hash = '#/assets/static/uploads';
  });

  test('validates the name, then creates the folder and stays put', async () => {
    vi.mocked(createSubfolder).mockResolvedValue(undefined);

    await render(NewFolderDialog);
    expect(page.getByRole('dialog').elements()).toHaveLength(0);

    showNewSubfolderDialog.current = true;

    const dialog = page.getByRole('dialog', { name: 'New Folder' });
    const textbox = dialog.getByRole('textbox', { name: 'Folder Name' });
    const create = dialog.getByRole('button', { name: 'Create' });

    await expect
      .element(dialog.getByText('The new folder will be created in “\u2068/static/uploads\u2069”.'))
      .toBeVisible();
    // An empty name can’t be used, but the error waits until something is typed
    await expect.element(create).toBeDisabled();
    expect(dialog.element().querySelector('.error')).toHaveTextContent('');

    await textbox.fill('2024');
    await expect
      .element(dialog.getByText('A folder or file with this name already exists here.'))
      .toBeVisible();
    await expect.element(create).toBeDisabled();

    await textbox.fill('A.PNG');
    await expect
      .element(dialog.getByText('A folder or file with this name already exists here.'))
      .toBeVisible();

    await textbox.fill('.hidden');
    await expect
      .element(dialog.getByText('The folder name cannot contain slashes or start with a dot.'))
      .toBeVisible();

    await textbox.fill('');
    await expect.element(dialog.getByText('The folder name cannot be empty.')).toBeVisible();

    await textbox.fill(' Summer Photos ');
    await expect.element(create).toBeEnabled();
    await create.click();

    await vi.waitFor(() =>
      expect(createSubfolder).toHaveBeenCalledWith('static/uploads/Summer Photos'),
    );
    // The new folder is listed where the user is, rather than opened
    await expect.poll(() => page.getByRole('dialog').elements().length).toBe(0);
    expect(window.location.hash).toBe('#/assets/static/uploads');
  });

  test('creates the folder in the subfolder being browsed, reporting the progress', async () => {
    /**
     * Settle the pending commit.
     * @type {() => void}
     */
    let resolve = () => {};

    vi.mocked(createSubfolder).mockReturnValue(
      new Promise((_resolve) => {
        resolve = _resolve;
      }),
    );
    selectedSubfolderPath.current = '2024';
    showNewSubfolderDialog.current = true;

    await render(NewFolderDialog);

    const dialog = page.getByRole('dialog', { name: 'New Folder' });

    await expect
      .element(
        dialog.getByText('The new folder will be created in “\u2068/static/uploads/2024\u2069”.'),
      )
      .toBeVisible();

    // The names taken at the root don’t count here
    await dialog.getByRole('textbox', { name: 'Folder Name' }).fill('a.png');
    await dialog.getByRole('button', { name: 'Create' }).click();

    await vi.waitFor(() =>
      expect(createSubfolder).toHaveBeenCalledWith('static/uploads/2024/a.png'),
    );
    // The commit can take a while, and the dialog is gone by now, so a toast says it’s under way
    await expect
      .poll(() =>
        document
          .querySelector('.sui.toast:not([aria-hidden="true"]) .sui.alert.info')
          ?.textContent?.replace(/\s+/g, ' ')
          .trim(),
      )
      .toBe('info Information Creating the folder…');

    resolve();
    await expect
      .poll(() => document.querySelector('.sui.toast:not([aria-hidden="true"]) .sui.alert.info'))
      .toBeNull();
    expect(window.location.hash).toBe('#/assets/static/uploads');
  }, 15000);

  test('names the repository root when the folder has no path of its own', async () => {
    selectedAssetFolder.current = undefined;
    showNewSubfolderDialog.current = true;

    await render(NewFolderDialog);

    await expect
      .element(
        page
          .getByRole('dialog', { name: 'New Folder' })
          .getByText('The new folder will be created in “\u2068/\u2069”.'),
      )
      .toBeVisible();
  });

  test('reports a failure to create the folder', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.mocked(createSubfolder).mockRejectedValue(new Error('offline'));
    showNewSubfolderDialog.current = true;

    try {
      await render(NewFolderDialog);

      const dialog = page.getByRole('dialog', { name: 'New Folder' });

      await dialog.getByRole('textbox', { name: 'Folder Name' }).fill('new');
      await dialog.getByRole('button', { name: 'Create' }).click();

      await vi.waitFor(() => expect(createSubfolder).toHaveBeenCalledWith('static/uploads/new'));
      // A toast stays in the DOM while hidden, so look for the one that is shown
      await expect
        .poll(() =>
          document
            .querySelector('.sui.toast:not([aria-hidden="true"]) .sui.alert.error')
            ?.textContent?.replace(/\s+/g, ' ')
            .trim(),
        )
        .toBe('error Error Couldn’t create the folder.');
      expect(window.location.hash).toBe('#/assets/static/uploads');
      await waitForToastsToHide();
    } finally {
      error.mockRestore();
    }
  }, 15000);
});
