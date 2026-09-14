import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { uploadingAssets } from '$lib/services/assets';
import { selectedAssetFolder } from '$lib/services/assets/folders';
import { currentView } from '$lib/services/assets/view/settings';
import { forkedRepository } from '$lib/services/workflow/open-authoring';
import { createMockAsset, initTestConfig, setAssets } from '$lib/test/config';

import AssetList from './asset-list.svelte';

/**
 * Build a drop event carrying the given files.
 * @param {File[]} files Files.
 * @returns {Event} Event.
 */
const createDropEvent = (files) => {
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

  return event;
};

describe('AssetList', () => {
  beforeAll(async () => {
    await initTestConfig();
  });

  beforeEach(() => {
    selectedAssetFolder.current = undefined;
    forkedRepository.current = undefined;
    currentView.current = { type: 'grid' };
  });

  test('lists the assets, accepting dropped files', async () => {
    setAssets([createMockAsset({ name: 'a.png' }), createMockAsset({ name: 'b.png' })]);

    const { container } = await render(AssetList);
    const grid = page.getByRole('grid', { name: 'Assets' });

    await expect.element(grid).toHaveAttribute('aria-rowcount', '2');
    await expect.element(grid.getByRole('row', { name: 'a.png' })).toBeInTheDocument();
    await expect.element(grid.getByRole('row', { name: 'b.png' })).toBeInTheDocument();

    const file = new File(['x'], 'c.png', { type: 'image/png' });

    /** @type {HTMLElement} */ (container.querySelector('.drop-target')).dispatchEvent(
      createDropEvent([file]),
    );

    await expect.poll(() => uploadingAssets.current.files).toEqual([file]);
    expect(uploadingAssets.current.folder?.internalPath).toBe('static/uploads');
  });

  test('offers to upload when the folder is empty', async () => {
    setAssets([]);

    await render(AssetList);

    await expect.element(page.getByText('No files found.')).toBeInTheDocument();
    await expect
      .element(page.getByRole('button', { name: 'Upload New Assets' }))
      .toBeInTheDocument();
  });

  test('doesn’t offer to upload while contributing via a fork', async () => {
    setAssets([]);
    forkedRepository.current = /** @type {any} */ ({ owner: 'me', repo: 'site' });

    await render(AssetList);

    await expect.element(page.getByText('No files found.')).toBeInTheDocument();
    expect(page.getByRole('button').elements()).toHaveLength(0);
  });
});
