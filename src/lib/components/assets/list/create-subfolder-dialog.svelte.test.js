import { beforeAll, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { createSubfolder } from '$lib/services/assets/data/subfolder';
import { initTestConfig } from '$lib/test/config';
import { waitForToastsToHide } from '$lib/test/toast';

import CreateSubfolderDialog from './create-subfolder-dialog.svelte';

vi.mock('$lib/services/assets/data/subfolder', () => ({
  createSubfolder: vi.fn(),
}));

/**
 * Get the text of the alert of the given status in the toast being shown, if any. A toast stays in
 * the DOM while hidden.
 * @param {'info' | 'error'} status Alert status.
 * @returns {string | undefined} Text.
 */
const getShownAlert = (status) =>
  document
    .querySelector(`.sui.toast:not([aria-hidden="true"]) .sui.alert.${status}`)
    ?.textContent?.replace(/\s+/g, ' ')
    .trim();

describe('CreateSubfolderDialog', () => {
  beforeAll(async () => {
    await initTestConfig();
  });

  test('creates the folder in the given directory, reporting the progress', async () => {
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

    const props = $state({ open: false, dirPath: 'static/uploads', takenNames: ['2024'] });

    await render(CreateSubfolderDialog, props);
    expect(page.getByRole('dialog').elements()).toHaveLength(0);

    props.open = true;

    const dialog = page.getByRole('dialog', { name: 'New Folder' });
    const textbox = dialog.getByRole('textbox', { name: 'Folder Name' });
    const create = dialog.getByRole('button', { name: 'Create' });

    await expect
      .element(dialog.getByText('The new folder will be created in “\u2068/static/uploads\u2069”.'))
      .toBeVisible();

    // A name already taken in the directory can’t be used
    await textbox.fill('2024');
    await expect.element(create).toBeDisabled();

    await textbox.fill('2025');
    await create.click();

    await vi.waitFor(() => expect(createSubfolder).toHaveBeenCalledWith('static/uploads/2025'));
    await expect.poll(() => props.open).toBe(false);
    // The commit can take a while, and the dialog is gone by now, so a toast says it’s under way
    await expect.poll(() => getShownAlert('info')).toBe('info Information Creating the folder…');

    resolve();
    await expect.poll(() => getShownAlert('info')).toBeUndefined();
    expect(getShownAlert('error')).toBeUndefined();
  }, 15000);

  test('creates the folder at the repository root, and reports a failure', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.mocked(createSubfolder).mockRejectedValue(new Error('offline'));

    try {
      await render(CreateSubfolderDialog, { open: true, dirPath: '', takenNames: [] });

      const dialog = page.getByRole('dialog', { name: 'New Folder' });

      await expect
        .element(dialog.getByText('The new folder will be created in “\u2068/\u2069”.'))
        .toBeVisible();
      await dialog.getByRole('textbox', { name: 'Folder Name' }).fill('new');
      await dialog.getByRole('button', { name: 'Create' }).click();

      await vi.waitFor(() => expect(createSubfolder).toHaveBeenCalledWith('new'));
      await expect
        .poll(() => getShownAlert('error'))
        .toBe('error Error Couldn’t create the folder.');
      expect(getShownAlert('info')).toBeUndefined();
      expect(error).toHaveBeenCalledWith(new Error('offline'));
      await waitForToastsToHide();
    } finally {
      error.mockRestore();
    }
  }, 15000);

  test('says nothing when the commit is cancelled', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.mocked(createSubfolder).mockRejectedValue(new Error('commit_cancelled'));

    try {
      await render(CreateSubfolderDialog, { open: true, dirPath: '', takenNames: [] });

      const dialog = page.getByRole('dialog', { name: 'New Folder' });

      await dialog.getByRole('textbox', { name: 'Folder Name' }).fill('new');
      await dialog.getByRole('button', { name: 'Create' }).click();

      await vi.waitFor(() => expect(createSubfolder).toHaveBeenCalledWith('new'));
      await expect.poll(() => getShownAlert('info')).toBeUndefined();
      expect(getShownAlert('error')).toBeUndefined();
      expect(error).not.toHaveBeenCalled();
    } finally {
      error.mockRestore();
    }
  }, 15000);
});
