import { sleep } from '@sveltia/utils/misc';
import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { uploadingAssets } from '$lib/services/assets';
import { getAssetFolder } from '$lib/services/assets/folders';
import { getCollection, selectedCollection } from '$lib/services/contents/collection';
import { currentView } from '$lib/services/contents/collection/view/settings';
import { env } from '$lib/services/user/env.svelte';
import { forkedRepository } from '$lib/services/workflow/open-authoring';
import { createMockAsset, initTestConfig, setAssets } from '$lib/test/config';

import SecondarySidebar from './secondary-sidebar.svelte';

/**
 * Build a drop event carrying the given files.
 * @param {File[]} files Files.
 * @returns {Event} Event.
 */
const createDropEvent = (files) => {
  const event = new Event('drop', { bubbles: true, cancelable: true });

  Object.defineProperty(event, 'dataTransfer', {
    value: {
      dropEffect: '',
      items: files.map((file) => ({
        /**
         * Get the entry.
         * @returns {any} File entry.
         */
        webkitGetAsEntry: () => ({
          name: file.name,
          isFile: true,
          /**
           * Read the file.
           * @param {(file: File) => void} callback Callback.
           * @returns {void} Nothing.
           */
          file: (callback) => callback(file),
        }),
      })),
    },
  });

  return event;
};

describe('SecondarySidebar', () => {
  beforeAll(async () => {
    await initTestConfig({
      collections: [
        {
          name: 'posts',
          label: 'Posts',
          folder: 'content/posts',
          media_folder: '/static/posts',
          fields: [{ name: 'title', widget: 'string' }],
        },
        {
          name: 'pages',
          label: 'Pages',
          folder: 'content/pages',
          fields: [{ name: 'title', widget: 'string' }],
        },
      ],
    });

    const folder = getAssetFolder({ collectionName: 'posts' });

    setAssets([
      createMockAsset({ name: 'a.png', folderPath: 'static/posts', asset: { folder } }),
      createMockAsset({ name: 'b.png' }),
    ]);
  });

  beforeEach(() => {
    env.isLargeScreen = true;
    forkedRepository.current = undefined;
    selectedCollection.current = getCollection('posts');
    currentView.current = { ...currentView.current, showMedia: true };
    uploadingAssets.current = { folder: undefined, files: [] };
  });

  test('lists the assets of the collection folder, accepting drops', async () => {
    window.location.hash = '#/collections/posts';

    const { container } = await render(SecondarySidebar);
    const group = page.getByRole('group', { name: 'Collection Assets' });

    await expect.element(group).toHaveAttribute('id', 'collection-assets');
    await expect.poll(() => group.getByRole('option').elements().length).toBe(1);

    const file = new File(['x'], 'c.png', { type: 'image/png' });

    /** @type {HTMLElement} */ (container.querySelector('.drop-target')).dispatchEvent(
      createDropEvent([file]),
    );
    await expect.poll(() => uploadingAssets.current.files).toEqual([file]);
    expect(uploadingAssets.current.folder?.internalPath).toBe('static/posts');

    // Selecting an asset opens its details
    await sleep(150);
    await group.getByRole('option').click();
    await expect.poll(() => window.location.hash).toBe('#/assets/static/posts/a.png');
  });

  test('refuses drops while contributing via a fork', async () => {
    forkedRepository.current = /** @type {any} */ ({ owner: 'me', repo: 'site' });

    const { container } = await render(SecondarySidebar);

    await expect
      .element(page.getByRole('group', { name: 'Collection Assets' }))
      .toBeInTheDocument();

    /** @type {HTMLElement} */ (container.querySelector('.drop-target')).dispatchEvent(
      createDropEvent([new File(['x'], 'c.png', { type: 'image/png' })]),
    );
    await sleep(100);
    expect(uploadingAssets.current.files).toEqual([]);
  });

  test('is hidden without a collection folder, on a small screen, or when turned off', async () => {
    selectedCollection.current = getCollection('pages');
    expect((await render(SecondarySidebar)).container.children).toHaveLength(0);

    selectedCollection.current = getCollection('posts');
    env.isLargeScreen = false;
    expect((await render(SecondarySidebar)).container.children).toHaveLength(0);

    env.isLargeScreen = true;
    currentView.current = { ...currentView.current, showMedia: false };
    expect((await render(SecondarySidebar)).container.children).toHaveLength(0);
  });
});
