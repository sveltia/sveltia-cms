import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { uploadingAssets } from '$lib/services/assets';
import { globalAssetFolder } from '$lib/services/assets/folders';
import { showAssetOverlay, showUploadAssetsDialog } from '$lib/services/assets/view';
import { env } from '$lib/services/user/env.svelte';
import { createMockImageFile, initTestConfig } from '$lib/test/config';

import UploadAssetsDialog from './upload-assets-dialog.svelte';

describe('UploadAssetsDialog', () => {
  beforeAll(async () => {
    await initTestConfig();
  });

  beforeEach(() => {
    env.hasMouse = true;
    showAssetOverlay.current = true;
    uploadingAssets.current = { folder: undefined, files: [] };
  });

  test('offers a drop zone for new assets', async () => {
    showUploadAssetsDialog.current = true;

    await render(UploadAssetsDialog, {});

    const dialog = page.getByRole('dialog', { name: 'Upload New Assets' });

    await expect.element(dialog).toBeVisible();
    await expect.element(dialog.getByRole('button', { name: 'Choose Files' })).toBeVisible();

    // Cancel is the only way out of the dialog, as there’s nothing to confirm
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect.poll(() => showUploadAssetsDialog.current).toBe(false);
  });

  test('is titled after the asset being replaced, and accepts a single file of its type', async () => {
    const original = /** @type {any} */ ({
      name: 'photo.png',
      folder: globalAssetFolder.current,
    });

    uploadingAssets.current = { folder: undefined, files: [], originalAssets: [original] };
    showUploadAssetsDialog.current = true;

    await render(UploadAssetsDialog, {});

    const dialog = page.getByRole('dialog', { name: 'Replace \u2068photo.png\u2069' });

    await expect.element(dialog).toBeVisible();
    await expect.element(dialog.getByRole('button', { name: 'Choose File' })).toBeVisible();
    expect(document.querySelector('input[type="file"]')).toHaveAttribute('accept', 'image/png');

    // Any file can replace one of an unknown type
    uploadingAssets.current = {
      folder: undefined,
      files: [],
      originalAssets: [{ ...original, name: 'data.qqq' }],
    };
    await expect
      .element(page.getByRole('dialog', { name: 'Replace \u2068data.qqq\u2069' }))
      .toBeVisible();
    expect(document.querySelector('input[type="file"]')).not.toHaveAttribute('accept');

    // Dismissing the dialog drops the replacement request
    showUploadAssetsDialog.current = false;
    await expect.poll(() => uploadingAssets.current.originalAssets).toBe(undefined);
  });

  test('passes the chosen files on for confirmation', async () => {
    const original = /** @type {any} */ ({
      name: 'photo.png',
      folder: globalAssetFolder.current,
    });

    uploadingAssets.current = { folder: undefined, files: [], originalAssets: [original] };
    showUploadAssetsDialog.current = true;

    await render(UploadAssetsDialog, {});
    await expect.element(page.getByRole('dialog')).toBeVisible();

    const input = /** @type {HTMLInputElement} */ (document.querySelector('input[type="file"]'));

    // Cancelling the picker changes nothing
    input.dispatchEvent(new Event('change', { bubbles: true }));
    expect(uploadingAssets.current.files).toEqual([]);

    const file = await createMockImageFile({ name: 'new.png' });
    const dataTransfer = new DataTransfer();

    dataTransfer.items.add(file);
    input.files = dataTransfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));

    // The replacement goes to the original asset’s folder
    expect(uploadingAssets.current).toEqual({
      folder: globalAssetFolder.current,
      files: [file],
      originalAssets: [original],
    });
    await expect.poll(() => showUploadAssetsDialog.current).toBe(false);
  });

  test('opens the file picker right away on a touch device', async () => {
    env.hasMouse = false;

    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});

    try {
      await render(UploadAssetsDialog, {});
      expect(page.getByRole('dialog').elements()).toHaveLength(0);

      showUploadAssetsDialog.current = true;
      await vi.waitFor(() => expect(click).toHaveBeenCalledOnce());

      const input = /** @type {HTMLInputElement} */ (click.mock.instances[0]);

      // Cancelling the picker closes the request
      input.dispatchEvent(new Event('cancel', { bubbles: true }));
      await expect.poll(() => showUploadAssetsDialog.current).toBe(false);

      // Choosing files stores them in the target folder
      showUploadAssetsDialog.current = true;
      await vi.waitFor(() => expect(click).toHaveBeenCalledTimes(2));

      const file = await createMockImageFile({ name: 'new.png' });
      const dataTransfer = new DataTransfer();

      dataTransfer.items.add(file);
      input.files = dataTransfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      expect(uploadingAssets.current.files).toEqual([file]);
      expect(uploadingAssets.current.folder).toBe(globalAssetFolder.current);
      await expect.poll(() => showUploadAssetsDialog.current).toBe(false);
    } finally {
      click.mockRestore();
    }
  });

  test('closes along with the asset library overlay', async () => {
    showUploadAssetsDialog.current = true;

    await render(UploadAssetsDialog, {});
    showAssetOverlay.current = false;

    await expect.poll(() => showUploadAssetsDialog.current).toBe(false);
  });
});
