import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import {
  focusedExternalAsset,
  selectedCloudService,
  selectedExternalAssets,
} from '$lib/services/assets/external';
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
  });

  test('reflects the position and selection of the asset in the list', async () => {
    await render(AssetListItem, { asset, index: 2, viewType: 'grid' });

    const row = page.getByRole('row', { name: 'photo.png' });

    await expect.element(row).toHaveAttribute('aria-rowindex', '2');
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
});
