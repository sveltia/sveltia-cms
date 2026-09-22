import { sleep } from '@sveltia/utils/misc';
import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { processedAssets, uploadingAssets } from '$lib/services/assets';
import { saveAssets } from '$lib/services/assets/data/create';
import { globalAssetFolder } from '$lib/services/assets/folders';
import { showAssetOverlay } from '$lib/services/assets/view';
import { createMockAsset, initTestConfig, setAssets } from '$lib/test/config';
import { waitForToastsToHide } from '$lib/test/toast';

import UploadAssetsConfirmDialog from './upload-assets-confirm-dialog.svelte';

vi.mock('$lib/services/assets/data/create', () => ({ saveAssets: vi.fn() }));

/** A transparent 1×1 PNG. */
const PNG_BYTES = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  ),
  (char) => char.charCodeAt(0),
);

const image = new File([PNG_BYTES], 'photo.png', { type: 'image/png' });
const doc = new File(['x'], 'notes.txt', { type: 'text/plain' });

describe('UploadAssetsConfirmDialog', () => {
  beforeAll(async () => {
    await initTestConfig({ media_folder: 'static/uploads' });
  });

  beforeEach(() => {
    showAssetOverlay.current = true;
    uploadingAssets.current = { folder: undefined, files: [] };
  });

  test('confirms the files to be uploaded to the folder, then saves them', async () => {
    vi.mocked(saveAssets).mockResolvedValue(undefined);

    await render(UploadAssetsConfirmDialog, {});

    const folder = globalAssetFolder.current;

    uploadingAssets.current = { folder, files: [image, doc] };

    const dialog = page.getByRole('alertdialog', { name: 'Upload New Assets' });

    await expect.element(dialog).toBeVisible();
    await expect
      .element(dialog.getByRole('group', { name: 'Uploading Files' }))
      .toHaveTextContent(
        'These 2 files will be saved to the “\u2068/static/uploads\u2069” folder: photo.png PNG image · \u206870\u2069 bytes close draft notes.txt TXT · \u20681\u2069 bytes close',
      );
    expect(dialog.getByRole('listitem').elements()).toHaveLength(2);

    await dialog.getByRole('button', { name: 'Upload' }).click();

    await vi.waitFor(() =>
      expect(saveAssets).toHaveBeenCalledWith(
        { files: [image, doc], folder, replaceDuplicates: true },
        { commitType: 'uploadMedia' },
      ),
    );
    await expect.poll(() => uploadingAssets.current.files).toEqual([]);
  });

  test('names the subfolder the files will be saved to', async () => {
    vi.mocked(saveAssets).mockResolvedValue(undefined);
    setAssets([createMockAsset({ name: 'photo.png', folderPath: 'static/uploads/2024' })]);

    try {
      await render(UploadAssetsConfirmDialog, {});

      const folder = globalAssetFolder.current;

      uploadingAssets.current = { folder, subfolderPath: '2024', files: [image] };

      const dialog = page.getByRole('alertdialog', { name: 'Upload New Assets' });

      await expect
        .element(
          dialog.getByText(
            'This file will be saved to the “\u2068/static/uploads/2024\u2069” folder:',
          ),
        )
        .toBeVisible();
      // The duplicates are looked for in the subfolder
      await expect
        .element(dialog.getByRole('radiogroup', { name: 'File Name Conflict Resolution' }))
        .toBeInTheDocument();
      expect(dialog.element().textContent).toContain(
        'A file with the same name already exists in this folder. Do you want to replace it?',
      );

      await dialog.getByRole('button', { name: 'Upload' }).click();

      await vi.waitFor(() =>
        expect(saveAssets).toHaveBeenCalledWith(
          { files: [image], folder, subfolderPath: '2024', replaceDuplicates: true },
          { commitType: 'uploadMedia' },
        ),
      );
    } finally {
      setAssets([]);
    }
  });

  test('is worded as a replacement when replacing an asset', async () => {
    await render(UploadAssetsConfirmDialog, {});

    uploadingAssets.current = {
      folder: globalAssetFolder.current,
      files: [image],
      originalAssets: [/** @type {any} */ ({ name: 'old.png', folder: globalAssetFolder.current })],
    };

    const dialog = page.getByRole('alertdialog', { name: 'Replace Asset' });

    await expect.element(dialog).toBeVisible();
    await expect
      .element(dialog.getByRole('group', { name: 'Uploading Files' }))
      .toHaveTextContent(
        '“\u2068old.png\u2069” will be replaced with this file: photo.png PNG image · \u206870\u2069 bytes close',
      );
    await expect.element(dialog.getByRole('button', { name: 'Replace' })).toBeVisible();
  });

  test('clears the selection when cancelled', async () => {
    await render(UploadAssetsConfirmDialog, {});

    uploadingAssets.current = { folder: globalAssetFolder.current, files: [image] };

    await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click();

    await expect.poll(() => uploadingAssets.current.files).toEqual([]);
    expect(saveAssets).not.toHaveBeenCalled();
  });

  test('sets aside a file whose content doesn’t match its type', async () => {
    await render(UploadAssetsConfirmDialog, {});

    uploadingAssets.current = {
      folder: globalAssetFolder.current,
      files: [new File(['not an image'], 'fake.png', { type: 'image/png' })],
    };

    const dialog = page.getByRole('alertdialog');

    await expect.element(dialog.getByRole('group', { name: 'Invalid Files' })).toBeVisible();
    expect(dialog.getByRole('group', { name: 'Uploading Files' }).elements()).toHaveLength(0);
    await expect
      .element(dialog.getByRole('button', { name: 'Upload' }))
      .toHaveAttribute('aria-disabled', 'true');
  });

  test('asks whether to replace the files that already exist in the folder', async () => {
    vi.mocked(saveAssets).mockResolvedValue(undefined);

    const folder = globalAssetFolder.current;

    setAssets([createMockAsset({ name: 'photo.png', asset: { folder } })]);

    try {
      await render(UploadAssetsConfirmDialog, {});

      uploadingAssets.current = { folder, files: [image] };

      const dialog = page.getByRole('alertdialog');
      const options = dialog.getByRole('radiogroup', { name: 'File Name Conflict Resolution' });

      await expect.element(options).toBeInTheDocument();
      expect(dialog.element().textContent).toContain(
        'A file with the same name already exists in this folder. Do you want to replace it?',
      );

      await expect.element(options.getByRole('radio', { name: 'Replace' })).toBeChecked();
      // A Sveltia UI radio group starts handling clicks 100 ms after it’s mounted
      await sleep(150);
      await options.getByRole('radio', { name: 'Keep Both' }).click();
      await expect.element(options.getByRole('radio', { name: 'Keep Both' })).toBeChecked();
      await dialog.getByRole('button', { name: 'Upload' }).click();

      await vi.waitFor(() =>
        expect(saveAssets).toHaveBeenCalledWith(
          { files: [image], folder, replaceDuplicates: false },
          { commitType: 'uploadMedia' },
        ),
      );
    } finally {
      setAssets([]);
    }
  });

  test('sets aside a replacement in a different format', async () => {
    await render(UploadAssetsConfirmDialog, {});

    uploadingAssets.current = {
      folder: globalAssetFolder.current,
      files: [image],
      originalAssets: [/** @type {any} */ ({ name: 'old.jpg', folder: globalAssetFolder.current })],
    };

    const dialog = page.getByRole('alertdialog');

    await expect
      .element(dialog.getByRole('group', { name: 'Mismatched Files' }))
      .toHaveTextContent(
        'warning Warning This file cannot replace “\u2068old.jpg\u2069” because it’s in a different format. Please convert the file to the same format and try again. photo.png PNG image · \u206870\u2069 bytes close',
      );
    await expect
      .element(dialog.getByRole('button', { name: 'Replace' }))
      .toHaveAttribute('aria-disabled', 'true');
  });

  test('sets aside a file that is too large', async () => {
    await initTestConfig({
      media_folder: 'static/uploads',
      media_libraries: { default: { config: { max_file_size: 50 } } },
    });

    try {
      await render(UploadAssetsConfirmDialog, {});

      uploadingAssets.current = { folder: globalAssetFolder.current, files: [image, doc] };

      const dialog = page.getByRole('alertdialog');

      await expect
        .element(dialog.getByRole('group', { name: 'Oversized Files' }))
        .toHaveTextContent(
          'warning Warning This file cannot be uploaded because it exceeds the maximum size of \u2068\u206850\u2069 bytes\u2069. Please reduce the size or select a different file. photo.png PNG image · \u206870\u2069 bytes close',
        );
      expect(
        dialog.getByRole('group', { name: 'Uploading Files' }).getByRole('listitem').elements(),
      ).toHaveLength(1);
    } finally {
      await initTestConfig({ media_folder: 'static/uploads' });
    }
  });

  test('reports a failure to upload', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(saveAssets).mockRejectedValue(new Error('Boom'));

    await render(UploadAssetsConfirmDialog, {});

    uploadingAssets.current = { folder: globalAssetFolder.current, files: [image] };

    await page.getByRole('alertdialog').getByRole('button', { name: 'Upload' }).click();

    await expect
      .poll(() =>
        document.querySelector('.sui.alert.error')?.textContent?.replace(/\s+/g, ' ').trim(),
      )
      .toBe('error Error Upload failed.');
    await expect.poll(() => uploadingAssets.current.files).toEqual([]);
    await waitForToastsToHide();
  });

  test('closes along with the asset details overlay', async () => {
    await render(UploadAssetsConfirmDialog, {});

    uploadingAssets.current = { folder: globalAssetFolder.current, files: [image] };
    await expect.element(page.getByRole('alertdialog')).toBeInTheDocument();

    showAssetOverlay.current = false;
    await expect.poll(() => uploadingAssets.current.files).toEqual([]);
    await expect.poll(() => page.getByRole('alertdialog').elements().length).toBe(0);
  });

  test('reports while the files are being processed', async () => {
    await render(UploadAssetsConfirmDialog, {});

    uploadingAssets.current = { folder: globalAssetFolder.current, files: [image] };
    await expect.element(page.getByRole('alertdialog')).toBeInTheDocument();

    await expect.poll(() => processedAssets.current.validFiles.length).toBe(1);

    // Transcoding an image can take a while
    processedAssets.current = { ...processedAssets.current, processing: true };
    await expect
      .element(page.getByRole('status'))
      .toHaveTextContent('Processing a file. This may take a while.');
  });
});
