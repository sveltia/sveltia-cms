import { sleep } from '@sveltia/utils/misc';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { createMockExternalAsset } from '$lib/test/config';

import CopyAssetsButton from './copy-assets-button.svelte';

const textURL = URL.createObjectURL(new Blob(['Hello'], { type: 'text/plain' }));

const textAsset = createMockExternalAsset({
  fileName: 'notes.txt',
  asset: { downloadURL: textURL, previewURL: textURL },
});

const zipAsset = createMockExternalAsset({ fileName: 'archive.zip' });

const linkedAsset = createMockExternalAsset({
  fileName: 'avatar.png',
  asset: {
    id: 'https://example.com/avatar.png',
    description: 'https://example.com/avatar.png',
    downloadURL: 'https://example.com/avatar.png',
  },
});

/**
 * Open the copy menu.
 * @returns {Promise<void>}
 */
const openMenu = async () => {
  // Wait for the previous popup to be unmounted
  await expect.poll(() => document.querySelector('dialog.popup')).toBeNull();
  await page.getByRole('button', { name: 'Copy' }).click();
  // A Sveltia UI menu starts handling clicks 100 ms after it’s opened
  await sleep(150);
};

describe('CopyAssetsButton', () => {
  /** @type {import('vitest').MockInstance} */
  let writeText;

  beforeEach(() => {
    writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
  });

  test('copies the URL, path, ID or data of an asset', async () => {
    await render(CopyAssetsButton, { assets: [textAsset] });
    await openMenu();

    expect(
      page
        .getByRole('menuitem')
        .elements()
        .map((el) => el.textContent?.trim()),
    ).toEqual(['Public URL', 'File Path', 'File ID', 'File Data']);

    await page.getByRole('menuitem', { name: 'Public URL' }).click();
    expect(writeText).toHaveBeenLastCalledWith(textURL);
    await expect
      .element(page.getByRole('status'))
      .toHaveTextContent('check_circle Success URL copied to clipboard.');

    await openMenu();
    await page.getByRole('menuitem', { name: 'File Path' }).click();
    expect(writeText).toHaveBeenLastCalledWith('images/notes.txt');

    await openMenu();
    await page.getByRole('menuitem', { name: 'File ID' }).click();
    expect(writeText).toHaveBeenLastCalledWith('images/notes.txt');

    await openMenu();
    await page.getByRole('menuitem', { name: 'File Data' }).click();
    await vi.waitFor(() => expect(writeText).toHaveBeenLastCalledWith('Hello'));
  });

  test('copies the URLs of multiple assets', async () => {
    await render(CopyAssetsButton, { assets: [textAsset, zipAsset] });
    await openMenu();

    // Only a single file’s data can be copied
    await expect.element(page.getByRole('menuitem', { name: 'File Data' })).toBeDisabled();

    await page.getByRole('menuitem', { name: 'Public URLs' }).click();
    expect(writeText).toHaveBeenLastCalledWith(
      `${textURL}\nhttps://cdn.example.com/images/archive.zip`,
    );
    await expect
      .element(page.getByRole('status'))
      .toHaveTextContent('check_circle Success 2 URLs copied to clipboard.');
  });

  test('leaves out the path and ID of a linked file', async () => {
    await render(CopyAssetsButton, { assets: [linkedAsset] });
    await openMenu();

    expect(
      page
        .getByRole('menuitem')
        .elements()
        .map((el) => el.textContent?.trim()),
    ).toEqual(['Public URL', 'File Data']);
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

    const jpegURL = URL.createObjectURL(await canvas.convertToBlob({ type: 'image/jpeg' }));

    const jpegAsset = createMockExternalAsset({
      fileName: 'photo.jpg',
      asset: { downloadURL: jpegURL, previewURL: jpegURL },
    });

    try {
      await render(CopyAssetsButton, { assets: [jpegAsset] });
      await openMenu();
      await page.getByRole('menuitem', { name: 'File Data' }).click();
      await vi.waitFor(() => expect(write).toHaveBeenCalledOnce());

      const [items] = write.mock.calls[0];

      expect(items[0].types).toEqual(['image/png']);

      // A PNG is copied as is
      const pngURL = URL.createObjectURL(await canvas.convertToBlob({ type: 'image/png' }));

      await render(CopyAssetsButton, {
        assets: [
          createMockExternalAsset({
            fileName: 'photo.png',
            asset: { downloadURL: pngURL, previewURL: pngURL },
          }),
        ],
      });
      await page.getByRole('button', { name: 'Copy' }).nth(1).click();
      await sleep(150);
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
});
