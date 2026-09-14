import { beforeAll, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { searchTerms } from '$lib/services/search';
import { createMockAsset, initTestConfig, setAssets } from '$lib/test/config';

import AssetResults from './asset-results.svelte';

describe('AssetResults', () => {
  beforeAll(async () => {
    await initTestConfig();
  });

  test('lists the matching assets', async () => {
    searchTerms.current = 'photo';
    setAssets([createMockAsset({ name: 'photo.png' }), createMockAsset({ name: 'report.pdf' })]);

    await render(AssetResults, {});

    const grid = page.getByRole('grid', { name: 'Assets' });

    await expect.element(grid).toHaveAttribute('aria-rowcount', '1');
    await expect.element(grid.getByRole('row')).toHaveTextContent('draft Global Assets photo.png');
  });

  test('reports when nothing matches', async () => {
    searchTerms.current = 'video';
    setAssets([createMockAsset({ name: 'photo.png' })]);

    await render(AssetResults, {});
    await expect.element(page.getByText('No files found.')).toBeVisible();
  });

  test('shows nothing without search terms', async () => {
    searchTerms.current = '';

    const { container } = await render(AssetResults, {});

    expect(container.querySelector('[role="grid"], .empty-state')).toBeNull();
  });
});
