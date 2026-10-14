import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { saveAssets } from '$lib/services/assets/data/create';
import { editingAsset } from '$lib/services/assets/state';
import { showAssetOverlay } from '$lib/services/assets/view';
import { createMockAsset } from '$lib/test/config';
import { waitForToastsToHide } from '$lib/test/toast';

import EditAssetDialog from './edit-asset-dialog.svelte';

vi.mock('$lib/services/assets/data/create', () => ({
  createFileList: vi.fn(),
  updateStores: vi.fn(),
  saveAssets: vi.fn(),
}));

const asset = createMockAsset({
  name: 'notes.txt',
  file: new File(['Hello'], 'notes.txt', { type: 'text/plain' }),
});

describe('EditAssetDialog', () => {
  beforeEach(() => {
    showAssetOverlay.current = true;
    editingAsset.current = undefined;
    vi.mocked(saveAssets).mockResolvedValue(undefined);
  });

  test('edits the text of the asset being edited and saves it', async () => {
    await render(EditAssetDialog);

    expect(page.getByRole('dialog').elements()).toHaveLength(0);

    editingAsset.current = asset;

    const dialog = page.getByRole('dialog', { name: 'Edit \u2068notes.txt\u2069' });
    const textarea = dialog.getByRole('textbox');

    await expect.element(textarea).toHaveValue('Hello');
    await expect.element(dialog.getByRole('button', { name: 'Save' })).toBeDisabled();

    await textarea.fill('Hello, world!');
    await expect.element(dialog.getByRole('button', { name: 'Save' })).toBeEnabled();

    // Long lines can be wrapped
    await dialog.getByRole('switch', { name: 'Wrap Long Lines' }).click();
    expect(dialog.element().querySelector('.wrapper')).toHaveClass('wrap');

    await dialog.getByRole('button', { name: 'Save' }).click();

    await vi.waitFor(() => expect(saveAssets).toHaveBeenCalledOnce());

    const [{ folder, files, originalAssets }, options] = vi.mocked(saveAssets).mock.calls[0];

    expect(folder).toBe(asset.folder);
    expect(originalAssets).toEqual([asset]);
    expect(files[0].name).toBe('notes.txt');
    expect(files[0].type).toBe('text/plain');
    expect(await files[0].text()).toBe('Hello, world!');
    expect(options).toEqual({ commitType: 'uploadMedia' });
    await expect.poll(() => editingAsset.current).toBeUndefined();
  });

  test('closes along with the asset details overlay', async () => {
    await render(EditAssetDialog);

    editingAsset.current = asset;
    await expect.element(page.getByRole('dialog')).toBeInTheDocument();

    showAssetOverlay.current = false;
    await expect.poll(() => page.getByRole('dialog').elements().length).toBe(0);
    await expect.poll(() => editingAsset.current).toBeUndefined();
  });

  test('reports a failure to save, and reopens with the edited text', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.mocked(saveAssets).mockRejectedValueOnce(new Error('offline'));

    try {
      await render(EditAssetDialog);

      editingAsset.current = asset;

      const dialog = page.getByRole('dialog', { name: 'Edit \u2068notes.txt\u2069' });
      const textarea = dialog.getByRole('textbox');

      await expect.element(textarea).toHaveValue('Hello');
      await textarea.fill('Hello, world!');
      await dialog.getByRole('button', { name: 'Save' }).click();

      await vi.waitFor(() => expect(saveAssets).toHaveBeenCalledOnce());
      await expect
        .poll(() =>
          document
            .querySelector('.sui.toast:not([aria-hidden="true"]) .sui.alert.error')
            ?.textContent?.replace(/\s+/g, ' ')
            .trim(),
        )
        .toBe('error Error Save failed.');
      expect(error).toHaveBeenCalledWith(new Error('offline'));

      // The dialog is back with the edited text, so saving can be retried
      await expect.element(textarea).toHaveValue('Hello, world!');
      expect(editingAsset.current).toBe(asset);
      await dialog.getByRole('button', { name: 'Save' }).click();
      await vi.waitFor(() => expect(saveAssets).toHaveBeenCalledTimes(2));
      expect(await vi.mocked(saveAssets).mock.calls[1][0].files[0].text()).toBe('Hello, world!');
      await expect.poll(() => editingAsset.current).toBeUndefined();
      await waitForToastsToHide();
    } finally {
      error.mockRestore();
    }
  }, 15000);

  test('reopens with the edited text when the commit is cancelled, without reporting a failure', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.mocked(saveAssets).mockRejectedValueOnce(new Error('commit_cancelled'));

    try {
      await render(EditAssetDialog);

      editingAsset.current = asset;

      const dialog = page.getByRole('dialog');
      const textarea = dialog.getByRole('textbox');

      await expect.element(textarea).toHaveValue('Hello');
      await textarea.fill('Hello, world!');
      await dialog.getByRole('button', { name: 'Save' }).click();

      await vi.waitFor(() => expect(saveAssets).toHaveBeenCalledOnce());
      // The dialog is back with the edited text, so saving can be retried
      await expect.element(textarea).toHaveValue('Hello, world!');
      expect(editingAsset.current).toBe(asset);
      expect(
        document.querySelector('.sui.toast:not([aria-hidden="true"]) .sui.alert.error'),
      ).toBeNull();
      expect(error).not.toHaveBeenCalled();
    } finally {
      error.mockRestore();
    }
  }, 15000);

  test('lets go of the asset when saving fails after the asset details overlay has closed', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    /**
     * Fail the pending save.
     * @type {(reason: Error) => void}
     */
    let reject = () => {};

    vi.mocked(saveAssets).mockImplementationOnce(
      () =>
        new Promise((_resolve, _reject) => {
          reject = _reject;
        }),
    );

    try {
      await render(EditAssetDialog);

      editingAsset.current = asset;

      const dialog = page.getByRole('dialog');
      const textarea = dialog.getByRole('textbox');

      await expect.element(textarea).toHaveValue('Hello');
      await textarea.fill('Hello, world!');
      await dialog.getByRole('button', { name: 'Save' }).click();
      await vi.waitFor(() => expect(saveAssets).toHaveBeenCalledOnce());

      showAssetOverlay.current = false;
      reject(new Error('offline'));

      await expect
        .poll(() =>
          document
            .querySelector('.sui.toast:not([aria-hidden="true"]) .sui.alert.error')
            ?.textContent?.replace(/\s+/g, ' ')
            .trim(),
        )
        .toBe('error Error Save failed.');
      await expect.poll(() => editingAsset.current).toBeUndefined();
      expect(page.getByRole('dialog').elements()).toHaveLength(0);
      await waitForToastsToHide();
    } finally {
      error.mockRestore();
    }
  }, 15000);
});
