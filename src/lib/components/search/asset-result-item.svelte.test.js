import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { createMockAsset } from '$lib/test/config';

import AssetResultItem from './asset-result-item.svelte';

describe('AssetResultItem', () => {
  test('shows the asset with its folder, and opens it', async () => {
    window.location.hash = '#/search/photo';

    const { container } = await render(AssetResultItem, {
      asset: createMockAsset({ name: 'photo.png' }),
    });

    expect(container.querySelector('.collection')).toHaveTextContent('Global Assets');
    expect(container.querySelector('.title')).toHaveTextContent('photo.png');

    await page.getByRole('row').click();
    await expect.poll(() => window.location.hash).toBe('#/assets/static/uploads/photo.png');
  });
});
