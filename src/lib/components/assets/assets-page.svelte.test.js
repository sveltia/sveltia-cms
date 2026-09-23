import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { announcedPageStatus } from '$lib/services/app/navigation';
import { allAssets, focusedAsset, overlaidAsset } from '$lib/services/assets';
import { selectedCloudService } from '$lib/services/assets/external';
import {
  allAssetFolders,
  globalAssetFolder,
  selectedAssetFolder,
} from '$lib/services/assets/folders';
import { selectedSubfolderPath } from '$lib/services/assets/subfolders';
import { showAssetOverlay } from '$lib/services/assets/view';
import { currentView } from '$lib/services/assets/view/settings';
import { searchMode, searchTerms } from '$lib/services/search';
import { env } from '$lib/services/user/env.svelte';
import { prefs } from '$lib/services/user/prefs.svelte';
import {
  createMockAsset,
  createMockEntry,
  createMockImageFile,
  initTestConfig,
  setAssets,
  setEntries,
} from '$lib/test/config';

import AssetsPage from './assets-page.svelte';

describe('AssetsPage', () => {
  beforeEach(async () => {
    await initTestConfig({
      site_url: 'https://example.com',
      media_libraries: { uploadcare: { config: { publicKey: 'abc' } } },
      collections: [
        {
          name: 'posts',
          label: 'Posts',
          folder: 'content/posts',
          fields: [
            { name: 'title', widget: 'string' },
            { name: 'cover', widget: 'image' },
          ],
        },
      ],
    });

    setAssets([
      createMockAsset({ name: 'a.png', file: await createMockImageFile({ name: 'a.png' }) }),
      createMockAsset({ name: 'b.png', file: await createMockImageFile({ name: 'b.png' }) }),
    ]);
    setEntries([
      createMockEntry({
        slug: 'hello',
        content: { _default: { title: 'Hello', cover: 'https://cdn.example.net/x.png' } },
      }),
    ]);

    env.isSmallScreen = false;
    env.isLargeScreen = true;
    prefs.apiKeys = {};
    prefs.logins = {};
    currentView.current = { type: 'grid' };
    selectedAssetFolder.current = undefined;
    selectedSubfolderPath.current = '';
    selectedCloudService.current = undefined;
    showAssetOverlay.current = false;
    overlaidAsset.current = undefined;
    // A folder passed as history state by a previous test would be picked up by the router
    window.history.replaceState(null, '', window.location.href);
  });

  test('shows all the assets, following the URL', async () => {
    window.location.hash = '#/assets/-/all';

    const { container } = await render(AssetsPage);
    const library = page.getByRole('group', { name: 'Asset Library' });

    await expect.element(library.getByRole('listbox', { name: 'Asset Folder List' })).toBeVisible();

    const area = library.getByRole('main', { name: '\u2068All Assets\u2069 Asset Folder' });

    await expect.element(area.getByRole('grid', { name: 'Assets' })).toBeInTheDocument();
    await expect.poll(() => area.getByRole('row').elements().length).toBe(2);
    await expect
      .poll(() => announcedPageStatus.current)
      .toBe('You’re now viewing the “\u2068All Assets\u2069” asset folder, which has 2 assets.');
    expect(container.querySelector('h2')).toHaveTextContent('All Assets');

    // The Global Assets folder is selected from the sidebar
    window.location.hash = '#/assets/static/uploads';
    await expect.poll(() => selectedAssetFolder.current?.internalPath).toBe('static/uploads');
    await expect
      .element(page.getByRole('main', { name: '\u2068Global Assets\u2069 Asset Folder' }))
      .toBeInTheDocument();
  });

  test('redirects the index to all the assets on a large screen', async () => {
    window.location.hash = '#/assets';

    await render(AssetsPage);
    await expect.poll(() => window.location.hash).toBe('#/assets/-/all');
    await expect
      .poll(() => announcedPageStatus.current)
      .toBe('You’re now viewing the “\u2068All Assets\u2069” asset folder, which has 2 assets.');
  });

  test('shows the folder list alone on a small screen', async () => {
    env.isSmallScreen = true;
    window.location.hash = '#/assets';

    await render(AssetsPage);

    await expect.element(page.getByRole('listbox', { name: 'Asset Folder List' })).toBeVisible();
    await expect
      .poll(() => announcedPageStatus.current)
      .toBe('You’re now viewing the asset folder list.');
    expect(page.getByRole('grid').elements()).toHaveLength(0);
  });

  test('opens the details of an asset', async () => {
    window.location.hash = '#/assets/static/uploads/a.png';

    await render(AssetsPage);

    const overlay = page.getByRole('group', { name: 'Asset Editor' });

    await expect.element(overlay).toBeInTheDocument();
    expect(overlay.element().querySelector('h2')).toHaveTextContent('a.png');
    expect(announcedPageStatus.current).toBe(
      'You’re viewing the details of the “\u2068a.png\u2069” asset.',
    );
    expect(overlaidAsset.current?.name).toBe('a.png');

    // A missing asset
    window.location.hash = '#/assets/static/uploads/missing.png';
    await expect.element(page.getByText('File not found.')).toBeInTheDocument();
    expect(announcedPageStatus.current).toBe('File not found.');

    // A missing asset in a subfolder, which is browsed within the folder it belongs to
    window.location.hash = '#/assets/static/uploads/sub/missing.png';
    await expect.poll(() => selectedSubfolderPath.current).toBe('sub');
    expect(selectedAssetFolder.current?.internalPath).toBe('static/uploads');
    expect(announcedPageStatus.current).toBe('File not found.');

    // An asset in a folder that isn’t configured
    window.location.hash = '#/assets/content/missing.png';
    await expect.poll(() => selectedAssetFolder.current).toBeUndefined();
    expect(selectedSubfolderPath.current).toBe('');
    expect(announcedPageStatus.current).toBe('File not found.');
  });

  test('browses a subfolder of a folder', async () => {
    const folder = globalAssetFolder.current;

    setAssets([
      createMockAsset({ name: 'a.png', asset: { folder } }),
      createMockAsset({ name: 'b.png', folderPath: 'static/uploads/2024', asset: { folder } }),
    ]);
    window.location.hash = '#/assets/static/uploads/2024';

    await render(AssetsPage);

    await expect.poll(() => selectedSubfolderPath.current).toBe('2024');
    expect(selectedAssetFolder.current?.internalPath).toBe('static/uploads');
    await expect
      .element(page.getByRole('grid', { name: 'Assets' }).getByRole('row', { name: 'b.png' }))
      .toBeInTheDocument();
    // The toolbar is rendered once the folder is known
    await expect
      .element(
        page
          .getByRole('toolbar', { name: 'Folder' })
          .getByRole('button', { name: 'Global Assets' }),
      )
      .toBeInTheDocument();
    await expect
      .element(page.getByRole('toolbar', { name: 'Folder' }))
      .toMatchTextContent('Global Assets chevron_right 2024');
    // The folder in the sidebar stays selected while its subfolder is browsed
    await expect
      .element(page.getByRole('option', { name: /^Global Assets/ }))
      .toHaveAttribute('aria-selected', 'true');
  });

  test('shows the info of the focused asset in the sidebar', async () => {
    window.location.hash = '#/assets/-/all';
    currentView.current = { type: 'grid', showInfo: true };

    const { container } = await render(AssetsPage);
    const sidebar = page.getByRole('group', { name: 'Asset Info' });

    // The info of the folder is shown while no asset is focused
    await expect.element(sidebar).toMatchTextContent('Folder All Assets Contents 2 assets');

    const [firstAsset] = allAssets.current;

    focusedAsset.current = firstAsset;
    await expect
      .element(sidebar.getByRole('link', { name: 'https://example.com/uploads/a.png' }))
      .toBeInTheDocument();
    expect(container.querySelector('#asset-info img')).not.toBeNull();

    // A click on the empty area of the list brings the folder info back
    /** @type {HTMLElement} */ (container.querySelector('.list-container')).click();
    await expect.element(sidebar).toMatchTextContent('Folder All Assets');
    expect(focusedAsset.current).toBeUndefined();
  });

  test('selects all the assets while the index is being redirected', async () => {
    /** @type {HashChangeEvent[]} */
    const heldEvents = [];

    /**
     * Hold back the `hashchange` event of the redirect, which the app fires asynchronously in a
     * view transition, so the page is rendered before the redirect takes effect.
     * @param {HashChangeEvent} event Event.
     */
    const holdEvent = (event) => {
      event.stopImmediatePropagation();
      heldEvents.push(event);
    };

    window.location.hash = '#/assets/-/all';
    currentView.current = { type: 'grid', showInfo: true };

    // Let the `hashchange` events go by, as the app does before mounting the page, so the redirect
    // is the only navigation. The change to `-/all` above fires one of its own unless the previous
    // test has left the URL there, so wait for the one to the index
    await new Promise((resolve) => {
      /**
       * Resolve once the URL has changed to the index.
       * @param {HashChangeEvent} event Event.
       */
      const onHashChange = ({ newURL }) => {
        if (new URL(newURL).hash === '#/assets') {
          window.removeEventListener('hashchange', onHashChange);
          resolve(undefined);
        }
      };

      window.addEventListener('hashchange', onHashChange);
      window.location.hash = '#/assets';
    });

    // The previous test may have left the same announcement, which is only made once the redirect
    // has taken effect
    announcedPageStatus.current = '';
    window.addEventListener('hashchange', holdEvent, { capture: true });

    try {
      await render(AssetsPage);
      await expect.poll(() => heldEvents.length).toBe(1);

      const sidebar = page.getByRole('group', { name: 'Asset Info' });

      expect(window.location.hash).toBe('#/assets/-/all');
      await expect.element(sidebar).toMatchTextContent('Folder All Assets Contents 2 assets');
      expect(announcedPageStatus.current).toBe('');
      window.removeEventListener('hashchange', holdEvent, { capture: true });

      const [{ oldURL, newURL }] = heldEvents;

      window.dispatchEvent(new HashChangeEvent('hashchange', { oldURL, newURL }));
      await expect
        .poll(() => announcedPageStatus.current)
        .toBe('You’re now viewing the “\u2068All Assets\u2069” asset folder, which has 2 assets.');
      await expect.element(sidebar).toMatchTextContent('Folder All Assets Contents 2 assets');
    } finally {
      window.removeEventListener('hashchange', holdEvent, { capture: true });
    }
  });

  test('redirects to the first external location when no folder is configured', async () => {
    const folders = allAssetFolders.current;

    allAssetFolders.current = [];
    window.location.hash = '#/assets';

    try {
      await render(AssetsPage);
      await expect.poll(() => window.location.hash).toBe('#/assets/-/uploadcare');
    } finally {
      allAssetFolders.current = folders;
    }
  });

  test('redirects to the linked files when nothing else is configured', async () => {
    await initTestConfig({ site_url: 'https://example.com' });

    const folders = allAssetFolders.current;

    allAssetFolders.current = [];
    window.location.hash = '#/assets';

    try {
      await render(AssetsPage);
      await expect.poll(() => window.location.hash).toBe('#/assets/-/linked');
    } finally {
      allAssetFolders.current = folders;
    }
  });

  test('lists the assets on a cloud storage service once the credentials are there', async () => {
    vi.spyOn(window, 'fetch').mockRejectedValue(new Error('Offline'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    prefs.apiKeys = { uploadcare: 'key' };
    window.location.hash = '#/assets/-/uploadcare';

    await render(AssetsPage);

    await expect
      .element(page.getByRole('alert').nth(0))
      .toHaveTextContent('There was an error while searching assets. Please try again later.');
  });

  test('announces the folder the user has settled on', async () => {
    window.location.hash = '#/assets/-/all';

    await render(AssetsPage);
    // Move on before the announcement is made
    window.location.hash = '#/assets/static/uploads';

    await expect
      .poll(() => announcedPageStatus.current)
      .toMatch(/^You’re now viewing the “\u2068Global Assets\u2069” asset folder/);
    await new Promise((resolve) => {
      setTimeout(resolve, 150);
    });
    expect(announcedPageStatus.current).toMatch(
      /^You’re now viewing the “\u2068Global Assets\u2069” asset folder/,
    );
  });

  test('reports a missing folder', async () => {
    window.location.hash = '#/assets/missing';

    await render(AssetsPage);

    await expect
      .element(
        page.getByRole('group', { name: 'Asset Library' }).getByText('Asset folder not found.'),
      )
      .toBeInTheDocument();
    await expect.poll(() => announcedPageStatus.current).toBe('Asset folder not found.');
  });

  test('shows the files linked from entries', async () => {
    window.location.hash = '#/assets/-/linked';

    await render(AssetsPage);

    const area = page.getByRole('main', { name: '\u2068Linked Files\u2069 Asset Folder' });

    await expect.element(area.getByRole('row', { name: 'x.png' })).toBeInTheDocument();
    expect(selectedCloudService.current?.serviceId).toBe('linked');
    expect(announcedPageStatus.current).toBe(
      'You’re now viewing the assets on \u2068Linked Files\u2069.',
    );

    // The details of a linked file
    window.location.hash = '#/assets/-/linked/https://cdn.example.net/x.png';
    await expect.element(page.getByRole('group', { name: 'Asset Editor' })).toBeInTheDocument();
    expect(announcedPageStatus.current).toBe(
      'You’re viewing the details of the “\u2068x.png\u2069” asset.',
    );
  });

  test('asks for the credentials of a cloud storage service', async () => {
    window.location.hash = '#/assets/-/uploadcare';

    await render(AssetsPage);

    const area = page.getByRole('main', { name: '\u2068Uploadcare\u2069 Asset Folder' });

    await expect.element(area.getByRole('textbox')).toBeInTheDocument();
    expect(selectedCloudService.current?.serviceId).toBe('uploadcare');

    // An unknown service
    window.location.hash = '#/assets/-/unknown';
    await expect.element(page.getByText('Asset folder not found.')).toBeInTheDocument();
  });

  test('shows the search results', async () => {
    searchMode.current = 'assets';
    searchTerms.current = 'a';
    window.location.hash = '#/search/a';

    await render(AssetsPage);

    await expect.element(page.getByRole('toolbar')).toHaveTextContent('Search Results');
    await expect
      .element(page.getByRole('grid', { name: 'Assets' }).getByRole('row', { name: /a\.png/ }))
      .toBeInTheDocument();
  });
});
