import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { createMockAsset } from '$lib/test/config';
import { waitForToastsToHide } from '$lib/test/toast';

import DownloadAssetsButton from './download-assets-button.svelte';

const assets = [createMockAsset({ name: 'a.txt' }), createMockAsset({ name: 'b.txt' })];

describe('DownloadAssetsButton', () => {
  test('downloads each asset and reports the count', async () => {
    const getBlob = vi.fn(async () => new Blob(['x']));
    const getName = vi.fn((/** @type {any} */ asset) => asset.name);
    // A download is a click on a temporary link, which can’t be observed, so watch the link instead
    const clicks = /** @type {string[]} */ ([]);

    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      /**
       * Record the download.
       * @this {HTMLAnchorElement}
       */
      function mockClick() {
        clicks.push(this.download);
      },
    );

    try {
      await render(DownloadAssetsButton, { assets, getBlob, getName });
      await page.getByRole('button', { name: 'Download' }).click();

      await expect
        .element(page.getByRole('status'))
        .toHaveTextContent('check_circle Success 2 assets downloaded.');
      expect(getBlob).toHaveBeenCalledTimes(2);
      expect(clicks).toEqual(['a.txt', 'b.txt']);
      await waitForToastsToHide();
    } finally {
      click.mockRestore();
    }
  });

  test('reports a failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await render(DownloadAssetsButton, {
      assets: [assets[0]],
      getBlob: vi.fn().mockRejectedValue(new Error('Boom')),
      getName: vi.fn(),
    });
    await page.getByRole('button', { name: 'Download' }).click();

    // The error toast is shown in a popover, which the accessibility tree can miss
    await expect
      .poll(() =>
        document.querySelector('.sui.alert.error')?.textContent?.replace(/\s+/g, ' ').trim(),
      )
      .toBe(
        'error Error There was an error while downloading the selected asset. Please try again later.',
      );
  });

  test('is disabled without assets', async () => {
    await render(DownloadAssetsButton, { getBlob: vi.fn(), getName: vi.fn() });
    await expect.element(page.getByRole('button', { name: 'Download' })).toBeDisabled();
  });
});
