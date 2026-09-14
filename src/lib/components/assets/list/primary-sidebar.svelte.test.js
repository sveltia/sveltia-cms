import { sleep } from '@sveltia/utils/misc';
import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { externalAssetCounts, selectedCloudService } from '$lib/services/assets/external';
import { allAssetFolders, selectedAssetFolder } from '$lib/services/assets/folders';
import { searchMode } from '$lib/services/search';
import { env } from '$lib/services/user/env.svelte';
import {
  createMockAsset,
  createMockEntry,
  initTestConfig,
  setAssets,
  setEntries,
} from '$lib/test/config';

import PrimarySidebar from './primary-sidebar.svelte';

/**
 * @import { AssetFolderInfo } from '$lib/types/private';
 */

describe('PrimarySidebar', () => {
  beforeAll(async () => {
    await initTestConfig({
      media_folder: 'static/uploads',
      media_libraries: { uploadcare: { config: { publicKey: 'abc' } } },
      collections: [
        {
          name: 'posts',
          label: 'Posts',
          folder: 'content/posts',
          media_folder: '/static/posts',
          fields: [{ name: 'title', widget: 'string' }],
        },
        {
          name: 'docs',
          label: 'Docs',
          folder: 'content/docs',
          // Entry-relative, so assets can’t be dropped onto the folder
          media_folder: '',
          fields: [{ name: 'title', widget: 'string' }],
        },
        {
          name: 'pages',
          label: 'Pages',
          files: [
            {
              name: 'about',
              label: 'About Us',
              file: 'content/about.md',
              media_folder: '/static/about',
              fields: [{ name: 'title', widget: 'string' }],
            },
          ],
        },
      ],
      asset_collections: [{ name: 'gallery', label: 'Gallery', media_folder: 'static/gallery' }],
    });

    // The assets have to be in the configured folders to be counted
    const globalFolder = /** @type {AssetFolderInfo} */ (
      allAssetFolders.current.find(({ internalPath }) => internalPath === 'static/uploads')
    );

    const postsFolder = /** @type {AssetFolderInfo} */ (
      allAssetFolders.current.find(({ internalPath }) => internalPath === 'static/posts')
    );

    setAssets([
      createMockAsset({ name: 'a.png', asset: { folder: globalFolder } }),
      createMockAsset({ name: 'b.png', asset: { folder: globalFolder } }),
      createMockAsset({
        name: 'c.png',
        folderPath: 'static/posts',
        asset: { folder: postsFolder },
      }),
    ]);
    setEntries([
      createMockEntry({
        slug: 'hello',
        content: { _default: { title: 'Hello', body: '![](https://example.com/x.png)' } },
      }),
    ]);
  });

  beforeEach(() => {
    env.isSmallScreen = false;
    selectedAssetFolder.current = undefined;
    selectedCloudService.current = undefined;
    externalAssetCounts.current = {};
  });

  test('lists the asset folders and external locations with their counts', async () => {
    externalAssetCounts.current = { uploadcare: 5 };

    const listbox = page.getByRole('listbox', { name: 'Asset Folder List' });

    await render(PrimarySidebar);
    await expect.element(listbox).toHaveAttribute('aria-controls', 'assets-container');

    /**
     * Get the labels of the listed folders.
     * @returns {(string | undefined)[]} Labels.
     */
    const getLabels = () =>
      listbox
        .getByRole('option')
        .elements()
        .map((el) => el.textContent?.replace(/\s+/g, ' ').trim());

    await expect
      .poll(getLabels)
      .toEqual([
        'folder All Assets 3',
        'folder Global Assets 2',
        'folder Posts 1',
        'folder Docs 0',
        'folder Pages › About Us 0',
        'folder Gallery 0',
        'cloud Uploadcare 5',
        'link Linked Files 0',
      ]);

    // The groups are separated: the global folders, the collection folders, then asset collections
    expect(listbox.element().querySelectorAll('[role="separator"]')).toHaveLength(2);
    expect(page.getByRole('group', { name: 'Your Site' }).elements()).toHaveLength(1);
    expect(page.getByRole('group', { name: 'External Locations' }).elements()).toHaveLength(1);
  });

  test('lists the external locations alone without an asset folder', async () => {
    const folders = allAssetFolders.current;

    allAssetFolders.current = [];

    try {
      await render(PrimarySidebar);

      const listbox = page.getByRole('listbox', { name: 'Asset Folder List' });

      await expect.element(listbox.getByRole('option', { name: /Uploadcare/ })).toBeVisible();
      expect(page.getByRole('group', { name: 'Your Site' }).elements()).toHaveLength(0);
    } finally {
      allAssetFolders.current = folders;
    }
  });

  test('navigates to the selected folder or location', async () => {
    window.location.hash = '#/assets';

    await render(PrimarySidebar);
    // A Sveltia UI list box starts handling clicks 100 ms after it’s mounted
    await sleep(150);

    await page.getByRole('option', { name: /^Posts/ }).click();
    await expect.poll(() => window.location.hash).toBe('#/assets/static/posts');
    expect(window.history.state.folder.collectionName).toBe('posts');

    await page.getByRole('option', { name: /^All Assets/ }).click();
    await expect.poll(() => window.location.hash).toBe('#/assets/-/all');

    await page.getByRole('option', { name: /^Uploadcare/ }).click();
    await expect.poll(() => window.location.hash).toBe('#/assets/-/uploadcare');

    await page.getByRole('option', { name: /^Linked Files/ }).click();
    await expect.poll(() => window.location.hash).toBe('#/assets/-/linked');
  });

  test('highlights the selected folder unless searching', async () => {
    selectedAssetFolder.current = allAssetFolders.current.find(
      ({ internalPath }) => internalPath === 'static/uploads',
    );

    await render(PrimarySidebar);
    await expect
      .element(page.getByRole('option', { name: /^Global Assets/ }))
      .toHaveAttribute('aria-selected', 'true');

    const { container } = await render(PrimarySidebar, { isSearchPage: true });

    await expect.poll(() => container.querySelectorAll('[role="option"]').length).toBe(8);
    expect(container.querySelectorAll('[aria-selected="true"]')).toHaveLength(0);
  });

  test('adds a heading and a search bar on a small screen', async () => {
    env.isSmallScreen = true;
    searchMode.current = 'assets';
    window.location.hash = '#/assets';

    const { container } = await render(PrimarySidebar);

    expect(container.querySelector('h2')).toHaveTextContent('Assets');

    await page.getByRole('searchbox').click();
    await expect.poll(() => window.location.hash).toBe('#/search');
  });

  test('highlights a folder that can take the dragged assets', async () => {
    selectedAssetFolder.current = allAssetFolders.current.find(
      ({ internalPath }) => internalPath === 'static/uploads',
    );

    await render(PrimarySidebar);

    /**
     * Fire a drag event on the given option.
     * @param {string} name Option name.
     * @param {string} type Event type.
     * @returns {DataTransfer} Data transfer, holding the resulting drop effect.
     */
    const drag = (name, type) => {
      const dataTransfer = new DataTransfer();

      page
        .getByRole('option', { name: new RegExp(`^${name}`) })
        .element()
        .dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer }));

      return dataTransfer;
    };

    await expect.element(page.getByRole('option', { name: /^Docs/ })).toBeVisible();

    const posts = page.getByRole('option', { name: /^Posts/ });

    // Another folder can take the assets
    drag('Posts', 'dragover');
    await expect.element(posts).toHaveClass('dragover');
    drag('Posts', 'dragleave');
    await expect.element(posts).not.toHaveClass('dragover');
    drag('Posts', 'dragover');
    drag('Posts', 'dragend');
    await expect.element(posts).not.toHaveClass('dragover');
    drag('Posts', 'dragover');
    drag('Posts', 'drop');
    await expect.element(posts).not.toHaveClass('dragover');

    // The virtual folder and the current folder can’t
    drag('All Assets', 'dragover');
    await expect
      .element(page.getByRole('option', { name: /^All Assets/ }))
      .not.toHaveClass('dragover');
    drag('Global Assets', 'dragover');
    await expect
      .element(page.getByRole('option', { name: /^Global Assets/ }))
      .not.toHaveClass('dragover');

    // Neither can a folder with entry-relative paths
    const docs = page.getByRole('option', { name: /^Docs/ });

    docs.element().classList.add('dragover');
    ['dragover', 'dragleave', 'dragend', 'drop'].forEach((type) => drag('Docs', type));
    await expect.element(docs).toHaveClass('dragover');
  });
});
