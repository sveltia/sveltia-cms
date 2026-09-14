import { sleep } from '@sveltia/utils/misc';
import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { createMockAsset, initTestConfig } from '$lib/test/config';

import CopyAssetsButton from './copy-assets-button.svelte';

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
  // A Sveltia UI menu starts handling clicks 100 ms after it’s opened
  await sleep(150);
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
      .element(page.getByRole('alert'))
      .toHaveTextContent('check_circle URL copied to clipboard.');

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
      .element(page.getByRole('alert'))
      .toHaveTextContent('check_circle 2 URLs copied to clipboard.');
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
