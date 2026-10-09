import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import PreviewAssetButton from './preview-asset-button.svelte';

describe('PreviewAssetButton', () => {
  test('opens the preview of the asset', async () => {
    window.location.hash = '#/assets';

    await render(PreviewAssetButton, { path: '/assets/static/uploads/photo.png' });

    const button = page.getByRole('button', { name: 'Show Preview' });

    await expect.element(button).toHaveTextContent('Preview');
    await button.click();
    await expect.poll(() => window.location.hash).toBe('#/assets/static/uploads/photo.png');
  });

  test('navigates with the given history state', async () => {
    window.location.hash = '#/assets';

    await render(PreviewAssetButton, {
      path: '/assets/static/uploads/photo.png',
      state: { folder: { label: 'All' } },
    });

    await page.getByRole('button', { name: 'Show Preview' }).click();
    await expect.poll(() => window.location.hash).toBe('#/assets/static/uploads/photo.png');
    expect(window.history.state.folder).toEqual({ label: 'All' });
  });

  test('is disabled without a path', async () => {
    await render(PreviewAssetButton, {});
    await expect.element(page.getByRole('button')).toHaveAttribute('aria-disabled', 'true');
  });
});
