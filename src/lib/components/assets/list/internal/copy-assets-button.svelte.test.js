import { sleep } from '@sveltia/utils/misc';
import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { getAssetDetails } from '$lib/services/assets/details';
import { createMockAsset, initTestConfig } from '$lib/test/config';

import CopyAssetsButton from './copy-assets-button.svelte';

vi.mock('$lib/services/assets/details', async (importOriginal) => {
  const actual = /** @type {any} */ (await importOriginal());

  return { ...actual, getAssetDetails: vi.fn(actual.getAssetDetails) };
});

const textAsset = createMockAsset({
  name: 'notes.txt',
  file: new File(['Hello'], 'notes.txt', { type: 'text/plain' }),
});

const zipAsset = createMockAsset({
  name: 'archive.zip',
  file: new File(['x'], 'archive.zip', { type: 'application/zip' }),
});

/**
 * Open the copy menu.
 * @returns {Promise<void>}
 */
const openMenu = async () => {
  // Wait for the previous popup to be unmounted
  await expect.poll(() => document.querySelector('dialog.popup')).toBeNull();
  await page.getByRole('button', { name: 'Copy' }).click();
};

describe('CopyAssetsButton', () => {
  /** @type {import('vitest').MockInstance} */
  let writeText;

  beforeAll(async () => {
    await initTestConfig({ site_url: 'https://example.com' });
  });

  beforeEach(() => {
    writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
  });

  test('copies the public URL, file path or data of an asset', async () => {
    await render(CopyAssetsButton, { assets: [textAsset] });
    await openMenu();

    await page.getByRole('menuitem', { name: 'Public URL' }).click();
    expect(writeText).toHaveBeenLastCalledWith('https://example.com/uploads/notes.txt');
    await expect
      .element(page.getByRole('status'))
      .toHaveTextContent('check_circle Success URL copied to clipboard.');

    await openMenu();
    await page.getByRole('menuitem', { name: 'File Path' }).click();
    expect(writeText).toHaveBeenLastCalledWith('/static/uploads/notes.txt');

    await openMenu();
    await page.getByRole('menuitem', { name: 'File Data' }).click();
    await vi.waitFor(() => expect(writeText).toHaveBeenLastCalledWith('Hello'));
  });

  test('copies the URLs and paths of multiple assets', async () => {
    await render(CopyAssetsButton, { assets: [textAsset, zipAsset] });
    await openMenu();

    // Only a single file’s data can be copied
    await expect.element(page.getByRole('menuitem', { name: 'File Data' })).toBeDisabled();

    await page.getByRole('menuitem', { name: 'Public URLs' }).click();
    expect(writeText).toHaveBeenLastCalledWith(
      'https://example.com/uploads/notes.txt\nhttps://example.com/uploads/archive.zip',
    );
    await expect
      .element(page.getByRole('status'))
      .toHaveTextContent('check_circle Success 2 URLs copied to clipboard.');
  });

  test('can’t copy the data of a binary file', async () => {
    await render(CopyAssetsButton, { assets: [zipAsset] });
    await openMenu();

    await expect.element(page.getByRole('menuitem', { name: 'File Data' })).toBeDisabled();
  });

  test('copies the image data as a PNG', async () => {
    const write = vi.spyOn(navigator.clipboard, 'write').mockResolvedValue();
    const canvas = new OffscreenCanvas(4, 3);

    canvas.getContext('2d');

    const jpegAsset = createMockAsset({
      name: 'photo.jpg',
      file: new File([await canvas.convertToBlob({ type: 'image/jpeg' })], 'photo.jpg', {
        type: 'image/jpeg',
      }),
    });

    try {
      await render(CopyAssetsButton, { assets: [jpegAsset] });
      await openMenu();
      await page.getByRole('menuitem', { name: 'File Data' }).click();
      await vi.waitFor(() => expect(write).toHaveBeenCalledOnce());

      const [items] = write.mock.calls[0];

      expect(items[0].types).toEqual(['image/png']);

      // A PNG is copied as is
      const pngAsset = createMockAsset({
        name: 'photo.png',
        file: new File([await canvas.convertToBlob({ type: 'image/png' })], 'photo.png', {
          type: 'image/png',
        }),
      });

      await render(CopyAssetsButton, { assets: [pngAsset] });
      await page.getByRole('button', { name: 'Copy' }).nth(1).click();
      await page.getByRole('menuitem', { name: 'File Data' }).click();
      await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(2));
    } finally {
      write.mockRestore();
    }
  });

  test('is disabled without assets', async () => {
    await render(CopyAssetsButton, {});
    await expect.element(page.getByRole('button', { name: 'Copy' })).toBeDisabled();
  });

  test('ignores the details of an asset focused earlier that arrive late', async () => {
    const { promise, resolve } = Promise.withResolvers();

    vi.mocked(getAssetDetails).mockReturnValueOnce(/** @type {any} */ (promise));

    const { rerender } = await render(CopyAssetsButton, { assets: [textAsset] });

    await rerender({ assets: [zipAsset] });
    resolve({ publicURL: 'https://example.com/uploads/notes.txt' });
    await sleep(50);
    await openMenu();
    await page.getByRole('menuitem', { name: 'Public URL' }).click();
    expect(writeText).toHaveBeenLastCalledWith('https://example.com/uploads/archive.zip');
  });

  test('can’t copy the data of an asset focused earlier while another is looked up', async () => {
    const { rerender } = await render(CopyAssetsButton, { assets: [textAsset] });

    await openMenu();
    await expect.element(page.getByRole('menuitem', { name: 'File Data' })).toBeEnabled();
    await userEvent.keyboard('{Escape}');

    const { promise, resolve } = Promise.withResolvers();

    vi.mocked(getAssetDetails).mockReturnValueOnce(/** @type {any} */ (promise));
    await rerender({ assets: [createMockAsset({ name: 'other.txt', file: textAsset.file })] });
    await openMenu();
    await expect.element(page.getByRole('menuitem', { name: 'File Data' })).toBeDisabled();

    resolve({ publicURL: 'https://example.com/uploads/other.txt' });
    await expect.element(page.getByRole('menuitem', { name: 'File Data' })).toBeEnabled();
  });

  test('can’t copy the URL of an asset focused earlier while another is looked up', async () => {
    const { rerender } = await render(CopyAssetsButton, { assets: [textAsset] });

    await openMenu();
    await expect.element(page.getByRole('menuitem', { name: 'Public URL' })).toBeEnabled();
    await userEvent.keyboard('{Escape}');

    const { promise, resolve } = Promise.withResolvers();

    vi.mocked(getAssetDetails).mockReturnValueOnce(/** @type {any} */ (promise));
    await rerender({ assets: [zipAsset] });
    await openMenu();
    await expect.element(page.getByRole('menuitem', { name: 'Public URL' })).toBeDisabled();

    resolve({ publicURL: 'https://example.com/uploads/archive.zip' });
    await expect.element(page.getByRole('menuitem', { name: 'Public URL' })).toBeEnabled();
  });

  test('can’t copy the URL of an asset whose details can’t be retrieved', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const { rerender } = await render(CopyAssetsButton, { assets: [textAsset] });

      await openMenu();
      await expect.element(page.getByRole('menuitem', { name: 'Public URL' })).toBeEnabled();
      await userEvent.keyboard('{Escape}');

      vi.mocked(getAssetDetails).mockRejectedValueOnce(new Error('Download failed'));
      await rerender({ assets: [zipAsset] });
      await vi.waitFor(() => expect(consoleError).toHaveBeenCalledOnce());
      await openMenu();
      await expect.element(page.getByRole('menuitem', { name: 'Public URL' })).toBeDisabled();
    } finally {
      consoleError.mockRestore();
    }
  });

  test('can’t copy the data of a file that can’t be downloaded', async () => {
    // The test backend can’t download a file that isn’t held in memory
    await render(CopyAssetsButton, { assets: [createMockAsset({ name: 'lost.txt' })] });
    await openMenu();

    await expect.element(page.getByRole('menuitem', { name: 'Public URL' })).toBeEnabled();
    await expect.element(page.getByRole('menuitem', { name: 'File Data' })).toBeDisabled();
  });
});
