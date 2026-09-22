import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { focusedAsset, uploadingAssets } from '$lib/services/assets';
import { globalAssetFolder, selectedAssetFolder } from '$lib/services/assets/folders';
import { focusedSubfolder, selectedSubfolderPath } from '$lib/services/assets/subfolders';
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
    selectedSubfolderPath.current = '';
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

  test('takes the focus off the asset when the empty area is clicked', async () => {
    const assets = [createMockAsset({ name: 'a.png' })];

    setAssets(assets);

    const { container } = await render(AssetList);

    await expect.element(page.getByRole('row', { name: 'a.png' })).toBeInTheDocument();
    [focusedAsset.current] = assets;
    focusedSubfolder.current = { name: '2024', path: 'static/uploads/2024' };

    /** @type {HTMLElement} */ (container.querySelector('.list-container')).click();
    expect(focusedAsset.current).toBeUndefined();
    expect(focusedSubfolder.current).toBeUndefined();
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

  describe('with subfolders', () => {
    beforeAll(() => {
      const folder = globalAssetFolder.current;

      setAssets([
        createMockAsset({ name: 'a.png', asset: { folder } }),
        createMockAsset({ name: 'b.png', folderPath: 'static/uploads/2024', asset: { folder } }),
        createMockAsset({
          name: 'c.png',
          folderPath: 'static/uploads/2024/summer',
          asset: { folder },
        }),
      ]);
    });

    beforeEach(() => {
      selectedAssetFolder.current = globalAssetFolder.current;
    });

    test('lists the subfolders ahead of the assets in the folder', async () => {
      await render(AssetList);

      const grid = page.getByRole('grid', { name: 'Assets' });

      await expect.element(grid).toHaveAttribute('aria-rowcount', '2');
      await expect
        .element(grid.getByRole('row', { name: '2024' }))
        .toHaveAttribute('aria-rowindex', '1');
      await expect
        .element(grid.getByRole('row', { name: 'a.png' }))
        .toHaveAttribute('aria-rowindex', '2');
      expect(grid.getByRole('row', { name: 'b.png' }).elements()).toHaveLength(0);
    });

    test('lists a subfolder’s own content, and takes dropped files there', async () => {
      selectedSubfolderPath.current = '2024';

      const { container } = await render(AssetList);
      const grid = page.getByRole('grid', { name: 'Assets' });

      await expect.element(grid.getByRole('row', { name: 'summer' })).toBeInTheDocument();
      await expect.element(grid.getByRole('row', { name: 'b.png' })).toBeInTheDocument();
      expect(grid.getByRole('row', { name: 'a.png' }).elements()).toHaveLength(0);

      const file = new File(['x'], 'd.png', { type: 'image/png' });

      /** @type {HTMLElement} */ (container.querySelector('.drop-target')).dispatchEvent(
        createDropEvent([file]),
      );

      await expect.poll(() => uploadingAssets.current.files).toEqual([file]);
      expect(uploadingAssets.current.folder).toBe(globalAssetFolder.current);
      expect(uploadingAssets.current.subfolderPath).toBe('2024');
    });
  });
});
