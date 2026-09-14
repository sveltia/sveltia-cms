import { sleep } from '@sveltia/utils/misc';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { globalAssetFolder } from '$lib/services/assets/folders';
import { showContentOverlay } from '$lib/services/contents/editor';
import { createMockAsset, createMockImageFile, initTestConfig, setAssets } from '$lib/test/config';
import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import AssetPicker from './asset-picker.svelte';

const fieldConfig = { name: 'cover', widget: 'custom-image' };

/**
 * Render the picker within a draft.
 * @returns {Promise<{ draft: any, component: any, entryDraft: any }>} Draft, component instance
 * and draft state.
 */
const renderPicker = async () => {
  const draft = createMockDraft({ fields: [fieldConfig] });

  const { component, entryDraft } = await renderWithDraft(AssetPicker, {
    draft,
    props: { fieldConfig, typedKeyPath: 'cover' },
  });

  return { draft, component, entryDraft };
};

/**
 * Drop the given files onto the dialog.
 * @param {File[]} files Files.
 */
const dropFiles = (files) => {
  const event = new Event('drop', { bubbles: true, cancelable: true });

  Object.defineProperty(event, 'dataTransfer', {
    value: {
      dropEffect: '',
      items: files.map((file) => ({
        /**
         * Get the entry.
         * @returns {any} File entry.
         */
        webkitGetAsEntry: () => ({
          name: file.name,
          isFile: true,
          /**
           * Read the file.
           * @param {(file: File) => void} callback Callback.
           * @returns {void} Nothing.
           */
          file: (callback) => callback(file),
        }),
      })),
    },
  });

  /** @type {HTMLElement} */ (document.querySelector('.drop-target')).dispatchEvent(event);
};

describe('AssetPicker', () => {
  beforeEach(async () => {
    await initTestConfig({
      site_url: 'https://example.com',
      collections: [
        { name: 'posts', label: 'Posts', folder: 'content/posts', fields: [fieldConfig] },
      ],
    });
    setAssets([
      createMockAsset({
        name: 'photo.png',
        file: await createMockImageFile(),
        asset: { folder: globalAssetFolder.current },
      }),
    ]);
    showContentOverlay.current = true;
  });

  test('opens the dialog and resolves with the picked asset', async () => {
    const { component } = await renderPicker();

    expect(page.getByRole('dialog').elements()).toHaveLength(0);

    const promise = component.pick({ kind: 'image' });
    const dialog = page.getByRole('dialog', { name: 'Select Image' });

    await expect.element(dialog).toBeInTheDocument();

    // Another call made in the meantime shares the outcome
    const another = component.pick({ kind: 'image' });

    await expect
      .poll(() => document.querySelectorAll('#select-assets-grid [role="option"]').length)
      .toBe(1);
    await sleep(150);
    await page
      .elementLocator(
        /** @type {HTMLElement} */ (document.querySelector('#select-assets-grid [role="option"]')),
      )
      .click();
    await dialog.getByRole('button', { name: 'Insert' }).click();

    const picked = await promise;

    expect(picked.value).toBe('/static/uploads/photo.png');
    expect(picked.file).toBeInstanceOf(Blob);
    expect(await another).toBe(picked);
  });

  test('resolves with a URL, or a list when multiple files are allowed', async () => {
    const { component } = await renderPicker();
    const promise = component.pick({ multiple: true });
    const dialog = page.getByRole('dialog', { name: 'Select File' });

    await sleep(150);
    await dialog.getByRole('option', { name: 'Enter URL' }).click();
    await dialog.getByRole('textbox').fill('https://example.com/doc.pdf');
    await dialog.getByRole('button', { name: 'Insert' }).click();

    expect(await promise).toEqual([{ value: 'https://example.com/doc.pdf', file: undefined }]);
  });

  test('resolves with nothing when cancelled', async () => {
    const { component } = await renderPicker();
    const promise = component.pick();

    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
    expect(await promise).toBeNull();
  });

  test('can’t enter a URL when disallowed', async () => {
    const { component } = await renderPicker();

    component.pick({ allowURL: false });

    const dialog = page.getByRole('dialog');

    await expect.element(dialog).toBeInTheDocument();
    expect(dialog.getByRole('option', { name: 'Enter URL' }).elements()).toHaveLength(0);
  });

  test('can only be used while an entry is being edited', async () => {
    const { component, entryDraft } = await renderPicker();

    entryDraft.current = null;
    await expect(component.pick()).rejects.toThrow(
      'pickFile() can only be called while an entry is being edited',
    );
  });

  test('reports a rejected file and resolves with nothing', async () => {
    await initTestConfig({
      site_url: 'https://example.com',
      media_libraries: { default: { config: { max_file_size: 10 } } },
      collections: [
        { name: 'posts', label: 'Posts', folder: 'content/posts', fields: [fieldConfig] },
      ],
    });

    const { component } = await renderPicker();
    const promise = component.pick({ kind: 'image' });
    const dialog = page.getByRole('dialog', { name: 'Select Image' });

    await expect.element(dialog).toBeInTheDocument();
    dropFiles([await createMockImageFile({ name: 'big.png' })]);
    await expect.element(dialog.getByRole('button', { name: 'Insert' })).toBeEnabled();
    await dialog.getByRole('button', { name: 'Insert' }).click();

    expect(await promise).toBeNull();

    const alert = page.getByRole('alertdialog', { name: 'Large File' });

    await expect
      .element(alert)
      .toHaveTextContent(
        'Large File This file cannot be uploaded because it exceeds the maximum size of ' +
          '\u2068\u206810\u2069 bytes\u2069. Please reduce the size or select a different file. big.png OK',
      );
    await alert.getByRole('button', { name: 'OK' }).click();
    await expect.poll(() => document.querySelector('[role="alertdialog"]')).toBeNull();
  });

  test('fails when the picked asset can’t be read', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // The file of the asset is not available, and the test backend can’t download it
    setAssets([
      createMockAsset({ name: 'lost.png', asset: { folder: globalAssetFolder.current } }),
    ]);

    const { component } = await renderPicker();
    const promise = component.pick({ kind: 'image' });
    const dialog = page.getByRole('dialog', { name: 'Select Image' });

    await expect
      .poll(() => document.querySelectorAll('#select-assets-grid [role="option"]').length)
      .toBe(1);
    await sleep(150);
    await page
      .elementLocator(
        /** @type {HTMLElement} */ (document.querySelector('#select-assets-grid [role="option"]')),
      )
      .click();
    await dialog.getByRole('button', { name: 'Insert' }).click();

    await expect(promise).rejects.toThrow();
  });
});
