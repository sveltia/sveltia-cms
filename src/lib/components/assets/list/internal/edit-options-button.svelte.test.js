import { sleep } from '@sveltia/utils/misc';
import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { editingAsset, renamingAsset, uploadingAssets } from '$lib/services/assets';
import { showUploadAssetsDialog } from '$lib/services/assets/view';
import { backendName } from '$lib/services/backends';
import { repository } from '$lib/services/backends/git/github/repository';
import { prefs } from '$lib/services/user/prefs.svelte';
import { openNewTab } from '$lib/services/utils/window';
import { forkedRepository } from '$lib/services/workflow/open-authoring';
import { createMockAsset, createMockImageFile, initTestConfig } from '$lib/test/config';

import EditOptionsButton from './edit-options-button.svelte';

vi.mock('$lib/services/utils/window', () => ({ openNewTab: vi.fn() }));

const textAsset = createMockAsset({ name: 'notes.txt' });
const imageAsset = createMockAsset({ name: 'photo.png' });

/**
 * Open the menu.
 * @returns {Promise<void>}
 */
const openMenu = async () => {
  // Wait for the previous popup to be unmounted
  await expect.poll(() => document.querySelector('dialog.popup')).toBeNull();
  await page.getByRole('button', { name: 'Show Edit Options' }).click();
  // A Sveltia UI menu starts handling clicks 100 ms after it’s opened
  await sleep(150);
};

describe('EditOptionsButton', () => {
  beforeAll(async () => {
    await initTestConfig({ site_url: 'https://example.com' });
    imageAsset.file = await createMockImageFile();
  });

  beforeEach(() => {
    backendName.current = undefined;
    forkedRepository.current = undefined;
    prefs.devModeEnabled = false;
    editingAsset.current = undefined;
    renamingAsset.current = undefined;
    showUploadAssetsDialog.current = false;
  });

  test('starts editing, renaming or replacing the asset', async () => {
    await render(EditOptionsButton, { asset: textAsset });
    await openMenu();

    expect(
      page
        .getByRole('menuitem')
        .elements()
        .map((el) => el.textContent?.trim()),
    ).toEqual(['Edit', 'Rename', 'Replace', 'View on Live Site']);

    await page.getByRole('menuitem', { name: 'Edit Asset' }).click();
    expect(editingAsset.current).toBe(textAsset);

    await openMenu();
    await page.getByRole('menuitem', { name: 'Rename Asset' }).click();
    expect(renamingAsset.current).toBe(textAsset);

    await openMenu();
    await page.getByRole('menuitem', { name: 'Replace Asset' }).click();
    expect(uploadingAssets.current).toEqual({
      folder: undefined,
      files: [],
      originalAssets: [textAsset],
    });
    expect(showUploadAssetsDialog.current).toBe(true);

    await openMenu();
    await page.getByRole('menuitem', { name: 'View on Live Site' }).click();
    await vi.waitFor(() =>
      expect(openNewTab).toHaveBeenCalledWith('https://example.com/uploads/notes.txt'),
    );
  });

  test('can’t edit a binary file', async () => {
    await render(EditOptionsButton, { asset: imageAsset });
    await openMenu();

    await expect.element(page.getByRole('menuitem', { name: 'Edit Asset' })).toBeDisabled();
    await expect.element(page.getByRole('menuitem', { name: 'Rename Asset' })).toBeEnabled();
  });

  test('disables everything without an asset', async () => {
    await render(EditOptionsButton, { asset: undefined });
    await openMenu();

    expect(
      page
        .getByRole('menuitem')
        .elements()
        .every((el) => el.ariaDisabled === 'true'),
    ).toBe(true);
  });

  test('disables the changes while contributing via a fork', async () => {
    forkedRepository.current = /** @type {any} */ ({ owner: 'me', repo: 'site' });

    await render(EditOptionsButton, { asset: textAsset });
    await openMenu();

    await expect.element(page.getByRole('menuitem', { name: 'Edit Asset' })).toBeDisabled();
    await expect.element(page.getByRole('menuitem', { name: 'Rename Asset' })).toBeDisabled();
    await expect.element(page.getByRole('menuitem', { name: 'Replace Asset' })).toBeDisabled();
    await expect.element(page.getByRole('menuitem', { name: 'View on Live Site' })).toBeEnabled();
  });

  test('offers the repository link in developer mode', async () => {
    prefs.devModeEnabled = true;

    await render(EditOptionsButton, { asset: textAsset });
    await openMenu();

    // The test backend has no repository
    await expect.element(page.getByRole('menuitem', { name: 'View in Repository' })).toBeDisabled();
  });

  test('opens the file in the repository', async () => {
    prefs.devModeEnabled = true;
    backendName.current = 'github';
    Object.assign(repository, {
      label: 'GitHub',
      blobBaseURL: 'https://github.com/me/site/blob/main',
    });

    try {
      await render(EditOptionsButton, { asset: textAsset });
      await openMenu();
      await page.getByRole('menuitem', { name: 'View on \u2068GitHub\u2069' }).click();
      expect(openNewTab).toHaveBeenCalledWith(
        'https://github.com/me/site/blob/main/static/uploads/notes.txt?plain=1',
      );
    } finally {
      Object.assign(repository, { label: '', blobBaseURL: '' });
    }
  });

  test('has no public URL for a file that can’t be read', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    // The test backend can’t download a file that isn’t held in memory
    await render(EditOptionsButton, { asset: createMockAsset({ name: 'lost.png' }) });
    await openMenu();

    await vi.waitFor(() =>
      expect(error).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Failed to retrieve blob' }),
      ),
    );
    await expect.element(page.getByRole('menuitem', { name: 'View on Live Site' })).toBeDisabled();
  });
});
