import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { selectedAssetFolder } from '$lib/services/assets/folders';
import { showUploadAssetsDialog } from '$lib/services/assets/view';
import { forkedRepository } from '$lib/services/workflow/open-authoring';
import { initTestConfig } from '$lib/test/config';

import UploadAssetsButton from './upload-assets-button.svelte';

describe('UploadAssetsButton', () => {
  beforeAll(async () => {
    await initTestConfig();
  });

  beforeEach(() => {
    selectedAssetFolder.current = undefined;
    forkedRepository.current = undefined;
    showUploadAssetsDialog.current = false;
  });

  test('opens the upload dialog', async () => {
    await render(UploadAssetsButton, { label: 'Upload' });
    await page.getByRole('button', { name: 'Upload New Assets' }).click();

    expect(showUploadAssetsDialog.current).toBe(true);
  });

  test('is disabled for a folder that can’t take uploads', async () => {
    selectedAssetFolder.current = /** @type {any} */ ({
      collectionName: 'posts',
      internalPath: 'content/posts',
      publicPath: '',
      entryRelative: true,
      hasTemplateTags: false,
    });

    await render(UploadAssetsButton, { label: 'Upload' });
    await expect.element(page.getByRole('button', { name: 'Upload New Assets' })).toBeDisabled();
  });

  test('is disabled while contributing via a fork', async () => {
    forkedRepository.current = /** @type {any} */ ({ owner: 'me', repo: 'site' });

    await render(UploadAssetsButton, { label: 'Upload' });
    await expect.element(page.getByRole('button', { name: 'Upload New Assets' })).toBeDisabled();
  });
});
