import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import {
  externalAssetSearchTerms,
  selectedCloudService,
  showNewExternalFolderDialog,
} from '$lib/services/assets/external';
import { env } from '$lib/services/user/env.svelte';
import { createMockCloudService } from '$lib/test/config';

import NewFolderButton from './new-folder-button.svelte';

describe('NewFolderButton', () => {
  beforeEach(() => {
    env.isSmallScreen = false;
    externalAssetSearchTerms.current = '';
    showNewExternalFolderDialog.current = false;
    selectedCloudService.current = createMockCloudService({
      browse: vi.fn(),
      createFolder: vi.fn(),
    });
  });

  test('opens the New Folder dialog', async () => {
    await render(NewFolderButton);

    const button = page.getByRole('button', { name: 'New Folder' });

    await expect.element(button).toHaveClass('ghost');
    await button.click();
    expect(showNewExternalFolderDialog.current).toBe(true);
  });

  test('is a floating button on a small screen', async () => {
    env.isSmallScreen = true;

    await render(NewFolderButton);

    await expect.element(page.getByRole('button', { name: 'New Folder' })).toHaveClass('secondary');
  });

  test('is left out while searching, or on a service that can’t create a folder', async () => {
    externalAssetSearchTerms.current = 'photo';

    await render(NewFolderButton);
    expect(page.getByRole('button', { name: 'New Folder' }).elements()).toHaveLength(0);

    externalAssetSearchTerms.current = '';
    await expect.element(page.getByRole('button', { name: 'New Folder' })).toBeInTheDocument();

    selectedCloudService.current = createMockCloudService({ browse: vi.fn() });
    await expect
      .poll(() => page.getByRole('button', { name: 'New Folder' }).elements())
      .toEqual([]);
  });
});
