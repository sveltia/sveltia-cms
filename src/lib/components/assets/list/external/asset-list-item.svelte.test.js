import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { ASSET_DRAG_TYPE } from '$lib/services/assets/drag';
import {
  externalAssets,
  externalAssetSearchTerms,
  focusedExternalAsset,
  focusedExternalSubfolder,
  selectedCloudService,
  selectedExternalAssets,
} from '$lib/services/assets/external';
import { externalAssetAvailability } from '$lib/services/assets/external/availability';
import { linkedFilesService } from '$lib/services/assets/external/linked';
import { draggedFiles } from '$lib/services/assets/state';
import { env } from '$lib/services/user/env.svelte';
import { forkedRepository } from '$lib/services/workflow/open-authoring';
import { createMockCloudService, createMockExternalAsset } from '$lib/test/config';

import AssetListItem from './asset-list-item.svelte';

const asset = createMockExternalAsset({ fileName: 'photo.png' });

describe('AssetListItem', () => {
  beforeEach(() => {
    env.isSmallScreen = false;
    env.isMediumScreen = false;
    env.hasMouse = true;
    selectedCloudService.current = createMockCloudService();
    selectedExternalAssets.current = [];
    focusedExternalAsset.current = undefined;
    focusedExternalSubfolder.current = undefined;
    externalAssetSearchTerms.current = '';
    externalAssetAvailability.current = {};
    externalAssets.current = undefined;
    draggedFiles.current = undefined;
    forkedRepository.current = undefined;
  });

  test('shows the path in place of the name while a folder service is searched', async () => {
    selectedCloudService.current = createMockCloudService({ browse: vi.fn() });
    focusedExternalSubfolder.current = { name: 'images', path: 'images' };

    await render(AssetListItem, { asset, viewType: 'list' });

    await expect.element(page.getByRole('row', { name: 'photo.png' })).toBeInTheDocument();

    // Focusing the asset takes the focus off a folder
    await page.getByRole('row', { name: 'photo.png' }).click();
    expect(focusedExternalAsset.current).toBe(asset);
    expect(focusedExternalSubfolder.current).toBeUndefined();

    externalAssetSearchTerms.current = 'photo';
    await expect.element(page.getByRole('row', { name: 'images/photo.png' })).toBeInTheDocument();
  });

  test('reflects the position and selection of the asset in the list', async () => {
    externalAssets.current = [
      createMockExternalAsset({ fileName: 'a.png' }),
      createMockExternalAsset({ fileName: 'b.png' }),
      asset,
    ];

    await render(AssetListItem, { asset, viewType: 'grid' });

    const row = page.getByRole('row', { name: 'photo.png' });

    await expect.element(row).toHaveAttribute('aria-rowindex', '3');
    await expect.element(row.getByRole('img', { name: 'photo.png' })).toBeInTheDocument();

    await row.getByRole('checkbox').click({ force: true });
    expect(selectedExternalAssets.current).toEqual([asset]);
    await expect.element(row.getByRole('checkbox')).toBeChecked();

    await row.getByRole('checkbox').click({ force: true });
    expect(selectedExternalAssets.current).toEqual([]);
  });

  test('focuses the asset and opens the details on double click', async () => {
    window.location.hash = '#/assets/-/test_cloud';

    await render(AssetListItem, { asset, viewType: 'list' });

    const row = page.getByRole('row', { name: 'photo.png' });

    await row.click();
    expect(focusedExternalAsset.current).toBe(asset);

    await row.dblClick();
    await expect.poll(() => window.location.hash).toBe('#/assets/-/test_cloud/images/photo.png');
  });

  test('marks a linked file that couldn’t be loaded', async () => {
    const linkedAsset = createMockExternalAsset({
      fileName: 'gone.png',
      asset: { id: 'https://example.com/gone.png', downloadURL: 'https://example.com/gone.png' },
    });

    selectedCloudService.current = linkedFilesService;

    const { container } = await render(AssetListItem, {
      asset: linkedAsset,
      viewType: 'grid',
    });

    // The status cell is there so the rows keep their layout, but it’s empty until the file is
    // known to be missing
    await expect.element(page.getByRole('row', { name: 'gone.png' })).toBeInTheDocument();
    expect(container.querySelector('.status')).not.toBeNull();
    expect(container.querySelector('.status')?.textContent?.trim()).toBe('');

    externalAssetAvailability.current = { [linkedAsset.id]: false };
    await expect.element(page.getByText('Unavailable')).toBeVisible();

    externalAssetAvailability.current = { [linkedAsset.id]: true };
    await expect.poll(() => container.querySelector('.status')?.textContent?.trim()).toBe('');
  });

  test('leaves out the status cell with the title on a small-screen tile', async () => {
    const linkedAsset = createMockExternalAsset({
      fileName: 'gone.png',
      asset: { id: 'https://example.com/gone.png', downloadURL: 'https://example.com/gone.png' },
    });

    env.isSmallScreen = true;
    selectedCloudService.current = linkedFilesService;
    externalAssetAvailability.current = { [linkedAsset.id]: false };

    const { container } = await render(AssetListItem, {
      asset: linkedAsset,
      viewType: 'grid',
    });

    await expect.element(page.getByRole('row', { name: 'gone.png' })).toBeInTheDocument();
    expect(container.querySelector('.title')).toBeNull();
    expect(container.querySelector('.status')).toBeNull();

    // The list view keeps the title, and the badge with it
    const { container: list } = await render(AssetListItem, {
      asset: linkedAsset,
      viewType: 'list',
    });

    await expect.poll(() => list.querySelector('.status')?.textContent?.trim()).toBe('Unavailable');
  });

  test('has no status cell on a cloud storage service', async () => {
    externalAssetAvailability.current = { [asset.id]: false };

    const { container } = await render(AssetListItem, { asset, viewType: 'list' });

    await expect.element(page.getByRole('row', { name: 'photo.png' })).toBeInTheDocument();
    expect(container.querySelector('.status')).toBeNull();
  });

  test('drags the file, or the selection it’s part of, to be moved to a folder', async () => {
    const service = createMockCloudService({ delete: vi.fn() });
    const other = createMockExternalAsset({ fileName: 'other.png' });

    selectedCloudService.current = service;

    await render(AssetListItem, { asset, viewType: 'list' });

    const row = page.getByRole('row', { name: 'photo.png' });

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

    // The file alone, as it isn’t selected
    selectedExternalAssets.current = [other];
    expect(dragStart().getData(ASSET_DRAG_TYPE)).toBe('["images/photo.png"]');
    expect(draggedFiles.current).toEqual({ externalAssets: [asset], service });

    row.element().dispatchEvent(new DragEvent('dragend', { bubbles: true }));
    expect(draggedFiles.current).toBeUndefined();

    // Every selected file, as it’s part of the selection
    selectedExternalAssets.current = [asset, other];
    expect(dragStart().getData(ASSET_DRAG_TYPE)).toBe('["images/photo.png","images/other.png"]');
    expect(draggedFiles.current).toEqual({ externalAssets: [asset, other], service });
  });

  test('can’t drag a linked file, or a file that can’t be moved', async () => {
    const linkedAsset = createMockExternalAsset({
      fileName: 'linked.png',
      asset: { id: 'https://example.com/linked.png' },
    });

    // A file linked from an entry isn’t on a service the CMS manages
    selectedCloudService.current = { ...linkedFilesService, delete: vi.fn() };

    const { unmount } = await render(AssetListItem, { asset: linkedAsset, viewType: 'list' });

    await expect
      .element(page.getByRole('row', { name: 'linked.png' }))
      .not.toHaveAttribute('draggable', 'true');
    unmount();

    // A service that can’t delete a file can’t move one either
    selectedCloudService.current = createMockCloudService();

    const row = page.getByRole('row', { name: 'photo.png' });
    const { unmount: unmount2 } = await render(AssetListItem, { asset, viewType: 'list' });

    await expect.element(row).not.toHaveAttribute('draggable', 'true');
    unmount2();

    // Nor can a file be moved while the media library is locked
    selectedCloudService.current = createMockCloudService({ delete: vi.fn() });
    forkedRepository.current = /** @type {any} */ ({ owner: 'me', repo: 'site' });

    await render(AssetListItem, { asset, viewType: 'list' });

    await expect.element(row).toBeInTheDocument();
    await expect.element(row).not.toHaveAttribute('draggable', 'true');
  });
});
