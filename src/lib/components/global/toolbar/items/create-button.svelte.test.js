import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { showUploadAssetsDialog } from '$lib/services/assets/view';
import { cmsConfig } from '$lib/services/config';
import { allEntries } from '$lib/services/contents';
import { collectionCacheMap } from '$lib/services/contents/collection';
import { forkedRepository } from '$lib/services/workflow/open-authoring';
import { createMockEntry, initTestConfig, setEntries } from '$lib/test/config';

import CreateButton from './create-button.svelte';

describe('CreateButton', () => {
  beforeEach(() => {
    // A test that loads a configuration of its own leaves the collections it resolved in the cache,
    // and assigning `cmsConfig` below doesn’t go through the loader that would clear them, so every
    // test would otherwise see whichever configuration ran last
    collectionCacheMap.clear();
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

  test('leaves the index file out of the entry quota', async () => {
    await initTestConfig({
      collections: [
        {
          name: 'pages',
          label: 'Pages',
          label_singular: 'Page',
          folder: 'content/pages',
          index_file: true,
          limit: 1,
          fields: [{ name: 'title', widget: 'string' }],
        },
        {
          name: 'posts',
          label: 'Posts',
          label_singular: 'Post',
          folder: 'content/posts',
          index_file: true,
          limit: 1,
          fields: [{ name: 'title', widget: 'string' }],
        },
      ],
    });
    setEntries([
      createMockEntry({ slug: '_index', folder: 'content/pages' }),
      createMockEntry({ slug: '_index', folder: 'content/posts' }),
      createMockEntry({ slug: 'hello', folder: 'content/posts' }),
    ]);

    await render(CreateButton, {});
    await page.getByRole('button', { name: 'Create Entry or Assets' }).click();

    const menu = page.getByRole('menu', { name: 'Create Entry or Assets' });

    // The index file is the collection’s own page, so `pages` still has its one slot free, while
    // `posts` has used it up on `hello`
    // @see https://github.com/sveltia/sveltia-cms/issues/1005
    await expect
      .element(menu.getByRole('menuitem', { name: 'Page' }))
      .not.toHaveAttribute('aria-disabled', 'true');
    await expect
      .element(menu.getByRole('menuitem', { name: 'Post' }))
      .toHaveAttribute('aria-disabled', 'true');
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
