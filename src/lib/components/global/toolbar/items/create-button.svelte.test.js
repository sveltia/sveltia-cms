import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { showUploadAssetsDialog } from '$lib/services/assets/view';
import { cmsConfig } from '$lib/services/config';
import { allEntries } from '$lib/services/contents';
import { forkedRepository } from '$lib/services/workflow/open-authoring';

import CreateButton from './create-button.svelte';

describe('CreateButton', () => {
  beforeEach(() => {
    window.location.hash = '#/collections';
    showUploadAssetsDialog.current = false;
    forkedRepository.current = undefined;
    allEntries.current = [];
    cmsConfig.current = /** @type {any} */ ({
      collections: [
        { name: 'posts', label: 'Posts', label_singular: 'Post', folder: 'posts', fields: [] },
        { name: 'pages', label: 'Pages', folder: 'pages', fields: [], create: false },
        { name: 'notes', folder: 'notes', fields: [] },
        { name: 'settings', label: 'Settings', files: [] },
      ],
    });
  });

  test('offers to create an entry in each entry collection, and to upload assets', async () => {
    await render(CreateButton, {});
    await page.getByRole('button', { name: 'Create Entry or Assets' }).click();

    const menu = page.getByRole('menu', { name: 'Create Entry or Assets' });

    expect(
      menu
        .getByRole('menuitem')
        .elements()
        .map((el) => el.textContent?.trim()),
    ).toEqual(['Post', 'Pages', 'notes', 'Assets']);
    // Creation is disabled for the collection
    await expect
      .element(menu.getByRole('menuitem', { name: 'Pages' }))
      .toHaveAttribute('aria-disabled', 'true');

    await menu.getByRole('menuitem', { name: 'Post' }).click();
    await expect.poll(() => window.location.hash).toBe('#/collections/posts/new');
  });

  test('only offers to upload assets without an entry collection', async () => {
    cmsConfig.current = /** @type {any} */ ({
      collections: [{ name: 'settings', label: 'Settings', files: [] }],
    });

    await render(CreateButton, {});
    await page.getByRole('button', { name: 'Create Entry or Assets' }).click();

    const menu = page.getByRole('menu', { name: 'Create Entry or Assets' });

    expect(menu.getByRole('menuitem').elements()).toHaveLength(1);
    expect(menu.getByRole('separator').elements()).toHaveLength(0);
  });

  test('goes to the asset library and opens the upload dialog', async () => {
    await render(CreateButton, {});
    await page.getByRole('button', { name: 'Create Entry or Assets' }).click();
    await page.getByRole('menuitem', { name: 'Assets' }).click();

    await expect.poll(() => window.location.hash).toBe('#/assets');
    await expect.poll(() => showUploadAssetsDialog.current).toBe(true);
  });

  test('disables uploading assets while working on a fork', async () => {
    forkedRepository.current = /** @type {any} */ ({ owner: 'me', repo: 'site' });

    await render(CreateButton, {});
    await page.getByRole('button', { name: 'Create Entry or Assets' }).click();
    await expect
      .element(page.getByRole('menuitem', { name: 'Assets' }))
      .toHaveAttribute('aria-disabled', 'true');
  });
});
