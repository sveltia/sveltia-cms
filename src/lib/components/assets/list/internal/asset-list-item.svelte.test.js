import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { focusedAsset, selectedAssets } from '$lib/services/assets';
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
  });

  test('reflects the position and selection of the asset in the list', async () => {
    await render(AssetListItem, { asset: assets[1], viewType: 'grid' });

    const row = page.getByRole('row', { name: 'b.png' });

    await expect.element(row).toHaveAttribute('aria-rowindex', '1');

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
      .toHaveAttribute('aria-rowindex', '-1');
  });

  test('focuses the asset and opens the details on double click', async () => {
    window.location.hash = '#/assets';

    await render(AssetListItem, { asset: assets[0], viewType: 'list' });

    const row = page.getByRole('row', { name: 'a.png' });

    await row.click();
    expect(focusedAsset.current).toBe(assets[0]);

    await row.dblClick();
    await expect.poll(() => window.location.hash).toBe('#/assets/static/uploads/a.png');
  });
});
