import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { parseLocation } from '$lib/services/app/navigation';
import { ASSET_DRAG_TYPE } from '$lib/services/assets/drag';
import { selectedAssetFolder } from '$lib/services/assets/folders';
import { draggedFiles, focusedAsset, selectedAssets } from '$lib/services/assets/state';
import { focusedSubfolder } from '$lib/services/assets/subfolders';
import { env } from '$lib/services/user/env.svelte';
import { createMockAsset, createMockImageFile, initTestConfig, setAssets } from '$lib/test/config';

import AssetListItem from './asset-list-item.svelte';

const assets = [createMockAsset({ name: 'a.png' }), createMockAsset({ name: 'b.png' })];

describe('AssetListItem', () => {
  beforeAll(async () => {
    await initTestConfig();
    assets[0].file = await createMockImageFile({ name: 'a.png' });
    assets[1].file = await createMockImageFile({ name: 'b.png' });
    setAssets(assets);
  });

  beforeEach(() => {
    env.isSmallScreen = false;
    env.isMediumScreen = false;
    env.hasMouse = true;
    selectedAssets.current = [];
    focusedAsset.current = undefined;
    selectedAssetFolder.current = undefined;
    draggedFiles.current = undefined;
  });

  test('reflects the position and selection of the asset in the list', async () => {
    await render(AssetListItem, { asset: assets[1], viewType: 'grid' });

    const row = page.getByRole('row', { name: 'b.png' });

    await expect.element(row).toHaveAttribute('aria-rowindex', '2');

    await row.getByRole('checkbox').click({ force: true });
    expect(selectedAssets.current).toEqual([assets[1]]);
    await expect.element(row.getByRole('checkbox')).toBeChecked();

    await row.getByRole('checkbox').click({ force: true });
    expect(selectedAssets.current).toEqual([]);
    await expect.element(row.getByRole('checkbox')).not.toBeChecked();
  });

  test('has no position for an asset that isn’t listed', async () => {
    await render(AssetListItem, {
      asset: createMockAsset({ name: 'c.png' }),
      viewType: 'grid',
    });

    await expect
      .element(page.getByRole('row', { name: 'c.png' }))
      .not.toHaveAttribute('aria-rowindex');
  });

  test('focuses the asset and opens the details on double click', async () => {
    window.location.hash = '#/assets';
    focusedSubfolder.current = { name: '2024', path: 'static/uploads/2024' };

    await render(AssetListItem, { asset: assets[0], viewType: 'list' });

    const row = page.getByRole('row', { name: 'a.png' });

    // The asset’s info takes the place of a folder’s
    await row.click();
    expect(focusedAsset.current).toBe(assets[0]);
    expect(focusedSubfolder.current).toBeUndefined();

    await row.dblClick();
    await expect.poll(() => window.location.hash).toBe('#/assets/static/uploads/a.png');
  });

  test('opens the details within the selected folder, e.g. All Assets', async () => {
    window.location.hash = '#/assets/-/all';

    const allAssetsFolder = { internalPath: undefined, publicPath: undefined };

    selectedAssetFolder.current = /** @type {any} */ (allAssetsFolder);

    await render(AssetListItem, { asset: assets[0], viewType: 'list' });
    await page.getByRole('row', { name: 'a.png' }).dblClick();
    await expect.poll(() => window.location.hash).toBe('#/assets/static/uploads/a.png');
    // The folder travels as history state, so the page doesn’t switch to the asset’s own folder
    expect(window.history.state.folder).toEqual(allAssetsFolder);
  });

  test('encodes special characters in the file name of the opened asset', async () => {
    window.location.hash = '#/assets';

    const asset = createMockAsset({ name: '50%off #1.png' });

    await render(AssetListItem, { asset, viewType: 'list' });
    await page.getByRole('row', { name: '50%off #1.png' }).dblClick();
    await expect
      .poll(() => window.location.hash)
      .toBe('#/assets/static/uploads/50%25off%20%231.png');
    expect(parseLocation().path).toBe(`/assets/${asset.path}`);
  });

  test('drags the asset, or the selection it’s part of, to be moved to a folder', async () => {
    const other = createMockAsset({ name: 'c.png' });

    await render(AssetListItem, { asset: assets[0], viewType: 'list' });

    const row = page.getByRole('row', { name: 'a.png' });

    await expect.element(row).toHaveAttribute('draggable', 'true');

    /**
     * Start dragging the row.
     * @returns {DataTransfer} Data transfer, holding the drag data.
     */
    const dragStart = () => {
      const dataTransfer = new DataTransfer();

      row
        .element()
        .dispatchEvent(
          new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer }),
        );

      return dataTransfer;
    };

    // The asset alone, as it isn’t selected
    selectedAssets.current = [other];
    expect(dragStart().getData(ASSET_DRAG_TYPE)).toBe('["static/uploads/a.png"]');
    expect(draggedFiles.current).toEqual({ assets: [assets[0]] });

    row.element().dispatchEvent(new DragEvent('dragend', { bubbles: true }));
    expect(draggedFiles.current).toBeUndefined();

    // Every selected asset, as it’s part of the selection
    selectedAssets.current = [assets[0], other];
    expect(dragStart().getData(ASSET_DRAG_TYPE)).toBe(
      '["static/uploads/a.png","static/uploads/c.png"]',
    );
    expect(draggedFiles.current).toEqual({ assets: [assets[0], other] });
  });

  test('can’t drag an asset in a read-only folder', async () => {
    const asset = createMockAsset({ name: 'd.png', asset: { folder: { ...assets[0].folder } } });

    asset.folder.readonly = true;

    await render(AssetListItem, { asset, viewType: 'list' });

    await expect
      .element(page.getByRole('row', { name: 'd.png' }))
      .not.toHaveAttribute('draggable', 'true');
  });
});
