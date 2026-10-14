import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { deleteAssets } from '$lib/services/assets/data/delete';
import { globalAssetFolder, selectedAssetFolder } from '$lib/services/assets/folders';
import { preloadAssets } from '$lib/services/assets/info';
import { overlaidAsset } from '$lib/services/assets/state';
import { selectedSubfolderPath } from '$lib/services/assets/subfolders';
import { showAssetOverlay } from '$lib/services/assets/view';
import { currentView } from '$lib/services/assets/view/settings';
import {
  createMockAsset,
  createMockImageFile,
  initTestConfig,
  setAssets,
  setEntries,
} from '$lib/test/config';
import { waitForToastsToHide } from '$lib/test/toast';

import DetailsOverlay from './details-overlay.svelte';

vi.mock('$lib/services/assets/info', async (importOriginal) => ({
  ...(await importOriginal()),
  preloadAssets: vi.fn(),
}));

vi.mock('$lib/services/assets/data/delete', () => ({
  deleteAssets: vi.fn(),
  updateStores: vi.fn(),
}));

const assets = [
  createMockAsset({ name: 'a.png' }),
  createMockAsset({
    name: 'notes.txt',
    file: new File(['Hello, world!'], 'notes.txt', { type: 'text/plain' }),
  }),
  createMockAsset({
    name: 'doc.pdf',
    file: new File(['%PDF-1.4'], 'doc.pdf', { type: 'application/pdf' }),
    asset: { blobURL: 'blob:http://localhost/doc' },
  }),
  createMockAsset({
    name: 'song.mp3',
    file: new File(['x'], 'song.mp3', { type: 'audio/mpeg' }),
    asset: { blobURL: 'blob:http://localhost/song' },
  }),
  createMockAsset({
    name: 'archive.zip',
    file: new File(['x'], 'archive.zip', { type: 'application/zip' }),
  }),
];

const [imageAsset, textAsset, pdfAsset, audioAsset, zipAsset] = assets;

describe('DetailsOverlay', () => {
  beforeAll(async () => {
    await initTestConfig({ site_url: 'https://example.com' });
    imageAsset.file = await createMockImageFile({ name: 'a.png' });
    setAssets(assets);
    setEntries([]);
  });

  beforeEach(() => {
    showAssetOverlay.current = true;
    selectedAssetFolder.current = undefined;
    selectedSubfolderPath.current = '';
    currentView.current = { type: 'grid' };
    window.location.hash = '#/assets/static/uploads/notes.txt';
  });

  test('shows a text file with its info, moving between the listed assets', async () => {
    overlaidAsset.current = textAsset;

    const { container } = await render(DetailsOverlay);

    expect(container.querySelector('h2')).toHaveTextContent('notes.txt');
    await expect.element(page.getByRole('figure')).toHaveTextContent('Hello, world!');
    await expect.element(page.getByRole('heading', { name: 'Kind' })).toBeInTheDocument();
    await expect.element(page.getByText('text/plain')).toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: 'Copy' })).toBeEnabled();
    await expect.element(page.getByRole('button', { name: 'Delete Asset' })).toBeEnabled();

    await page.getByRole('button', { name: 'Next Asset' }).click();
    await expect.poll(() => window.location.hash).toBe('#/assets/static/uploads/doc.pdf');

    await page.getByRole('button', { name: 'Previous Asset' }).click();
    await expect.poll(() => window.location.hash).toBe('#/assets/static/uploads/a.png');
  });

  test('preloads the shown asset and the images around it, and releases them once closed', async () => {
    overlaidAsset.current = textAsset;

    const { unmount } = await render(DetailsOverlay);

    // The next asset is a PDF, which isn’t preloaded
    await vi.waitFor(() =>
      expect(preloadAssets).toHaveBeenLastCalledWith([expect.objectContaining({ name: 'a.png' })], {
        keep: [expect.objectContaining({ name: 'notes.txt' })],
      }),
    );

    unmount();
    expect(preloadAssets).toHaveBeenLastCalledWith([]);
  });

  test('keeps the selected folder, e.g. All Assets, while moving between the listed assets', async () => {
    const allAssetsFolder = { internalPath: undefined, publicPath: undefined };

    selectedAssetFolder.current = /** @type {any} */ (allAssetsFolder);
    overlaidAsset.current = textAsset;

    await render(DetailsOverlay);
    await page.getByRole('button', { name: 'Next Asset' }).click();
    await expect.poll(() => window.location.hash).toBe('#/assets/static/uploads/doc.pdf');
    expect(window.history.state.folder).toEqual(allAssetsFolder);
  });

  test('shows an image', async () => {
    overlaidAsset.current = imageAsset;

    await render(DetailsOverlay);

    await expect.element(page.getByRole('img', { name: 'a.png' })).toBeInTheDocument();
    // The first asset has no previous one
    await expect.element(page.getByRole('button', { name: 'Previous Asset' })).toBeDisabled();
    await expect.element(page.getByRole('button', { name: 'Next Asset' })).toBeEnabled();
  });

  test('shows an audio player, and skips the blob of an asset that has been switched away from', async () => {
    // A file that takes a while to read from the file system
    const slowAsset = createMockAsset({
      name: 'slow.txt',
      asset: {
        file: undefined,
        handle: /** @type {any} */ ({
          /**
           * Get the file.
           * @returns {Promise<File>} File.
           */
          getFile: () =>
            new Promise((resolve) => {
              setTimeout(() => {
                resolve(new File(['Slow'], 'slow.txt', { type: 'text/plain' }));
              }, 200);
            }),
        }),
      },
    });

    overlaidAsset.current = slowAsset;

    const { container } = await render(DetailsOverlay);

    // The blob of the text file is still being read
    overlaidAsset.current = audioAsset;
    await expect.poll(() => container.querySelector('audio')).not.toBeNull();
    await new Promise((resolve) => {
      setTimeout(resolve, 300);
    });
    expect(page.getByRole('figure').elements()).toHaveLength(0);
    expect(container.querySelector('h2')).toHaveTextContent('song.mp3');
  });

  test('shows a PDF in a frame', async () => {
    overlaidAsset.current = pdfAsset;

    const { container } = await render(DetailsOverlay);

    await expect.poll(() => container.querySelector('iframe')?.title).toBe('doc.pdf');
  });

  test('has no preview for a binary file', async () => {
    overlaidAsset.current = zipAsset;

    await render(DetailsOverlay);

    await expect.element(page.getByRole('alert')).toHaveTextContent('Preview Unavailable.');
    // The last asset has no next one
    await expect.element(page.getByRole('button', { name: 'Next Asset' })).toBeDisabled();
  });

  test('skips the listed assets that can’t be previewed', async () => {
    overlaidAsset.current = audioAsset;

    await render(DetailsOverlay);

    await expect.element(page.getByRole('button', { name: 'Previous Asset' })).toBeEnabled();
    // The binary file after the audio file isn’t opened in the overlay from the list either
    await expect.element(page.getByRole('button', { name: 'Next Asset' })).toBeDisabled();
  });

  test('reports a missing asset', async () => {
    overlaidAsset.current = undefined;

    await render(DetailsOverlay);

    await expect.element(page.getByText('File not found.')).toBeInTheDocument();
  });

  test('downloads and deletes the asset', async () => {
    const clicks = /** @type {string[]} */ ([]);

    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      /**
       * Record the download.
       * @this {HTMLAnchorElement}
       */
      function mockClick() {
        clicks.push(this.download);
      },
    );

    vi.mocked(deleteAssets).mockResolvedValue(undefined);
    overlaidAsset.current = textAsset;

    try {
      await render(DetailsOverlay);
      await expect.element(page.getByRole('figure')).toHaveTextContent('Hello, world!');

      await page.getByRole('button', { name: 'Download' }).click();
      await expect.poll(() => clicks).toEqual(['notes.txt']);

      await page.getByRole('button', { name: 'Delete Asset' }).click();

      const dialog = page.getByRole('alertdialog');

      await expect.element(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Delete' }).click();
      await vi.waitFor(() => expect(deleteAssets).toHaveBeenCalledWith([textAsset]));
      await expect.poll(() => window.location.hash).toBe('#/assets/-/all');
    } finally {
      click.mockRestore();
    }
  });

  test('reports a failure to delete the asset, and stays on it', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.mocked(deleteAssets).mockRejectedValue(new Error('offline'));
    overlaidAsset.current = textAsset;

    try {
      await render(DetailsOverlay);
      await page.getByRole('button', { name: 'Delete Asset' }).click();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
      await vi.waitFor(() => expect(deleteAssets).toHaveBeenCalledWith([textAsset]));
      await expect
        .poll(() =>
          document
            .querySelector('.sui.toast:not([aria-hidden="true"]) .sui.alert.error')
            ?.textContent?.replace(/\s+/g, ' ')
            .trim(),
        )
        .toBe('error Error Delete failed.');
      expect(error).toHaveBeenCalledWith(new Error('offline'));
      // The asset hasn’t been deleted, so the overlay isn’t left
      expect(window.location.hash).toBe('#/assets/static/uploads/notes.txt');
      await waitForToastsToHide();
    } finally {
      error.mockRestore();
    }
  }, 15000);

  test('stays on the asset when the commit is cancelled, without reporting a failure', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.mocked(deleteAssets).mockRejectedValue(new Error('commit_cancelled'));
    overlaidAsset.current = textAsset;

    try {
      await render(DetailsOverlay);
      await page.getByRole('button', { name: 'Delete Asset' }).click();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
      await vi.waitFor(() => expect(deleteAssets).toHaveBeenCalledWith([textAsset]));
      await expect.element(page.getByRole('alertdialog')).not.toBeInTheDocument();
      expect(
        document.querySelector('.sui.toast:not([aria-hidden="true"]) .sui.alert.error'),
      ).toBeNull();
      expect(error).not.toHaveBeenCalled();
      expect(window.location.hash).toBe('#/assets/static/uploads/notes.txt');
    } finally {
      error.mockRestore();
    }
  }, 15000);

  test('can’t delete an asset in a read-only folder', async () => {
    overlaidAsset.current = { ...zipAsset, folder: { ...zipAsset.folder, readonly: true } };

    await render(DetailsOverlay);

    await expect.element(page.getByRole('button', { name: 'Delete Asset' })).toBeDisabled();
    await expect.element(page.getByRole('button', { name: 'Download' })).toBeEnabled();
  });

  test('goes back to the folder', async () => {
    overlaidAsset.current = imageAsset;

    await render(DetailsOverlay);
    await page.getByRole('button', { name: 'Cancel Editing' }).click();

    await expect.poll(() => window.location.hash).toBe('#/assets/-/all');
  });

  test('goes back to the subfolder the asset was opened from', async () => {
    selectedAssetFolder.current = globalAssetFolder.current;
    selectedSubfolderPath.current = '2024/summer';
    overlaidAsset.current = imageAsset;

    await render(DetailsOverlay);
    await page.getByRole('button', { name: 'Cancel Editing' }).click();

    await expect.poll(() => window.location.hash).toBe('#/assets/static/uploads/2024/summer');
    expect(window.history.state.folder).toEqual(globalAssetFolder.current);
  });
});
