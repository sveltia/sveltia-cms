import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { globalAssetFolder, selectedAssetFolder } from '$lib/services/assets/folders';
import { showNewSubfolderDialog } from '$lib/services/assets/view';
import { env } from '$lib/services/user/env.svelte';
import { forkedRepository } from '$lib/services/workflow/open-authoring';
import { initTestConfig } from '$lib/test/config';

import NewSubfolderButton from './new-subfolder-button.svelte';

describe('NewSubfolderButton', () => {
  beforeAll(async () => {
    await initTestConfig();
  });

  beforeEach(() => {
    env.isSmallScreen = false;
    selectedAssetFolder.current = globalAssetFolder.current;
    forkedRepository.current = undefined;
    showNewSubfolderDialog.current = false;
  });

  test('opens the New Folder dialog', async () => {
    const { container } = await render(NewSubfolderButton);
    const button = page.getByRole('button', { name: 'New Folder' });

    // A ghost button on a large screen, next to the other toolbar actions
    expect(container.querySelector('button')).toHaveClass('ghost');

    await button.click();
    expect(showNewSubfolderDialog.current).toBe(true);
  });

  test('gets a surface on a small screen, where it floats', async () => {
    env.isSmallScreen = true;

    const { container } = await render(NewSubfolderButton);

    expect(container.querySelector('button')).toHaveClass('secondary');
  });

  test('is left out for the All Assets folder and a folder that can’t be browsed', async () => {
    selectedAssetFolder.current = undefined;

    await render(NewSubfolderButton);
    expect(page.getByRole('button').elements()).toHaveLength(0);

    selectedAssetFolder.current = /** @type {any} */ ({
      collectionName: 'posts',
      internalPath: 'content/posts',
      publicPath: '',
      entryRelative: true,
      hasTemplateTags: false,
    });

    await render(NewSubfolderButton);
    expect(page.getByRole('button').elements()).toHaveLength(0);
  });

  test('is disabled while contributing via a fork', async () => {
    forkedRepository.current = /** @type {any} */ ({ owner: 'me', repo: 'site' });

    await render(NewSubfolderButton);
    await expect.element(page.getByRole('button', { name: 'New Folder' })).toBeDisabled();
  });
});
