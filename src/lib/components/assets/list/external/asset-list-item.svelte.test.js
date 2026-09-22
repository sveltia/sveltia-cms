import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import {
  externalAssetSearchTerms,
  focusedExternalAsset,
  focusedExternalSubfolder,
  selectedCloudService,
  selectedExternalAssets,
} from '$lib/services/assets/external';
import { externalAssetAvailability } from '$lib/services/assets/external/availability';
import { linkedFilesService } from '$lib/services/assets/external/linked';
import { env } from '$lib/services/user/env.svelte';
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
  });

  test('shows the path in place of the name while a folder service is searched', async () => {
    selectedCloudService.current = createMockCloudService({ browse: vi.fn() });
    focusedExternalSubfolder.current = { name: 'images', path: 'images' };

    await render(AssetListItem, { asset, index: 0, viewType: 'list' });

    await expect.element(page.getByRole('row', { name: 'photo.png' })).toBeInTheDocument();

    // Focusing the asset takes the focus off a folder
    await page.getByRole('row', { name: 'photo.png' }).click();
    expect(focusedExternalAsset.current).toBe(asset);
    expect(focusedExternalSubfolder.current).toBeUndefined();

    externalAssetSearchTerms.current = 'photo';
    await expect.element(page.getByRole('row', { name: 'images/photo.png' })).toBeInTheDocument();
  });

  test('reflects the position and selection of the asset in the list', async () => {
    await render(AssetListItem, { asset, index: 2, viewType: 'grid' });

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

    await render(AssetListItem, { asset, index: 0, viewType: 'list' });

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
      index: 0,
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
      index: 0,
      viewType: 'grid',
    });

    await expect.element(page.getByRole('row', { name: 'gone.png' })).toBeInTheDocument();
    expect(container.querySelector('.title')).toBeNull();
    expect(container.querySelector('.status')).toBeNull();

    // The list view keeps the title, and the badge with it
    const { container: list } = await render(AssetListItem, {
      asset: linkedAsset,
      index: 0,
      viewType: 'list',
    });

    await expect.poll(() => list.querySelector('.status')?.textContent?.trim()).toBe('Unavailable');
  });

  test('has no status cell on a cloud storage service', async () => {
    externalAssetAvailability.current = { [asset.id]: false };

    const { container } = await render(AssetListItem, { asset, index: 0, viewType: 'list' });

    await expect.element(page.getByRole('row', { name: 'photo.png' })).toBeInTheDocument();
    expect(container.querySelector('.status')).toBeNull();
  });
});
