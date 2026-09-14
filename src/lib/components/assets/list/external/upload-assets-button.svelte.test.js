import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { selectedCloudService } from '$lib/services/assets/external';
import { uploadingExternalAssets } from '$lib/services/assets/external/data';
import { prefs } from '$lib/services/user/prefs.svelte';
import { createMockCloudService } from '$lib/test/config';

import UploadAssetsButton from './upload-assets-button.svelte';

describe('UploadAssetsButton', () => {
  beforeEach(() => {
    prefs.apiKeys = {};
    prefs.logins = {};
  });

  test('opens the file picker', async () => {
    selectedCloudService.current = createMockCloudService({ upload: vi.fn() });

    // The file dialog can’t be observed, so watch the hidden input instead
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});

    try {
      await render(UploadAssetsButton, { label: 'Upload' });
      await page.getByRole('button', { name: 'Upload New Assets' }).click();

      expect(click).toHaveBeenCalledOnce();

      const input = /** @type {HTMLInputElement} */ (click.mock.instances[0]);

      expect(input.multiple).toBe(true);

      // The chosen files are passed on for confirmation
      const file = new File(['x'], 'new.png', { type: 'image/png' });
      const dataTransfer = new DataTransfer();

      dataTransfer.items.add(file);
      input.files = dataTransfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      expect(uploadingExternalAssets.current).toEqual({ files: [file] });
    } finally {
      click.mockRestore();
    }
  });

  test('is disabled when the service doesn’t support uploading', async () => {
    selectedCloudService.current = createMockCloudService();

    await render(UploadAssetsButton, { label: 'Upload' });
    await expect.element(page.getByRole('button', { name: 'Upload New Assets' })).toBeDisabled();
  });

  test('is disabled until the user has signed in', async () => {
    selectedCloudService.current = createMockCloudService({
      authType: 'api_key',
      upload: vi.fn(),
    });

    await render(UploadAssetsButton, { label: 'Upload' });
    await expect.element(page.getByRole('button', { name: 'Upload New Assets' })).toBeDisabled();

    prefs.apiKeys = { test_cloud: 'secret' };
    await expect.element(page.getByRole('button', { name: 'Upload New Assets' })).toBeEnabled();
  });
});
