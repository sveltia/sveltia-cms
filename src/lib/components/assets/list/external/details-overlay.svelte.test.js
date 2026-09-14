import { sleep } from '@sveltia/utils/misc';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import {
  externalAssets,
  overlaidExternalAssetId,
  selectedCloudService,
} from '$lib/services/assets/external';
import { showAssetOverlay } from '$lib/services/assets/view';
import { currentView } from '$lib/services/assets/view/settings';
import { env } from '$lib/services/user/env.svelte';
import {
  createMockCloudService,
  createMockExternalAsset,
  createMockImageFile,
  initTestConfig,
  setEntries,
} from '$lib/test/config';

import DetailsOverlay from './details-overlay.svelte';

const textURL = URL.createObjectURL(new Blob(['Hello, world!'], { type: 'text/plain' }));

const assets = [
  createMockExternalAsset({ fileName: 'a.png' }),
  createMockExternalAsset({
    fileName: 'notes.txt',
    asset: { downloadURL: textURL, previewURL: textURL },
  }),
  createMockExternalAsset({ fileName: 'doc.pdf' }),
  createMockExternalAsset({ fileName: 'song.mp3' }),
  createMockExternalAsset({ fileName: 'archive.zip' }),
];

describe('DetailsOverlay', () => {
  beforeEach(async () => {
    await initTestConfig();
    setEntries([]);

    const imageURL = URL.createObjectURL(await createMockImageFile());

    assets[0].downloadURL = imageURL;
    assets[0].previewURL = imageURL;

    env.isSmallScreen = false;
    showAssetOverlay.current = true;
    currentView.current = { type: 'grid' };
    selectedCloudService.current = createMockCloudService({ delete: vi.fn(), rename: vi.fn() });
    externalAssets.current = [...assets];
    window.location.hash = '#/assets/-/test_cloud/images/notes.txt';
  });

  test('shows a text file with its info, moving between the listed assets', async () => {
    overlaidExternalAssetId.current = 'images/notes.txt';

    const { container } = await render(DetailsOverlay);

    expect(container.querySelector('h2')).toHaveTextContent('notes.txt');
    await expect.element(page.getByRole('figure')).toHaveTextContent('Hello, world!');
    await expect.element(page.getByText('text/plain')).toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: 'Copy' })).toBeEnabled();
    await expect.element(page.getByRole('button', { name: 'Delete Asset' })).toBeEnabled();
    await expect.element(page.getByRole('button', { name: 'Show Edit Options' })).toBeEnabled();

    // The actions stay in the toolbar rather than the menu
    await page.getByRole('button', { name: 'Show Edit Options' }).click();
    await expect.element(page.getByRole('menu')).toBeVisible();
    expect(page.getByRole('menuitem', { name: 'Download' }).elements()).toHaveLength(0);
    await userEvent.keyboard('{Escape}');

    await page.getByRole('button', { name: 'Next Asset' }).click();
    await expect.poll(() => window.location.hash).toBe('#/assets/-/test_cloud/images/doc.pdf');

    await page.getByRole('button', { name: 'Previous Asset' }).click();
    await expect.poll(() => window.location.hash).toBe('#/assets/-/test_cloud/images/a.png');
  });

  test('shows an image', async () => {
    overlaidExternalAssetId.current = 'images/a.png';

    await render(DetailsOverlay);

    await expect.element(page.getByRole('img', { name: 'a.png' }).first()).toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: 'Previous Asset' })).toBeDisabled();
    await expect.element(page.getByRole('button', { name: 'Next Asset' })).toBeEnabled();
  });

  test('shows an audio player', async () => {
    overlaidExternalAssetId.current = 'images/song.mp3';

    const { container } = await render(DetailsOverlay);

    await expect
      .poll(() => container.querySelector('audio')?.getAttribute('src'))
      .toBe('https://cdn.example.com/images/song.mp3');
  });

  test('shows a PDF in a frame', async () => {
    overlaidExternalAssetId.current = 'images/doc.pdf';

    const { container } = await render(DetailsOverlay);

    await expect.poll(() => container.querySelector('iframe')?.title).toBe('doc.pdf');
  });

  test('has no preview for a binary file', async () => {
    overlaidExternalAssetId.current = 'images/archive.zip';

    await render(DetailsOverlay);

    await expect.element(page.getByRole('alert')).toHaveTextContent('Preview Unavailable.');
    await expect.element(page.getByRole('button', { name: 'Next Asset' })).toBeDisabled();
  });

  test('hides the actions the service doesn’t support', async () => {
    selectedCloudService.current = createMockCloudService();
    overlaidExternalAssetId.current = 'images/a.png';

    await render(DetailsOverlay);

    await expect.element(page.getByRole('button', { name: 'Download' })).toBeEnabled();
    expect(page.getByRole('button', { name: 'Delete Asset' }).elements()).toHaveLength(0);
    expect(page.getByRole('button', { name: 'Show Edit Options' }).elements()).toHaveLength(0);
  });

  test('keeps the menu for the other actions on a small screen', async () => {
    env.isSmallScreen = true;
    selectedCloudService.current = createMockCloudService();
    overlaidExternalAssetId.current = 'images/a.png';

    await render(DetailsOverlay);

    await expect
      .element(page.getByRole('button', { name: 'Show Edit Options' }))
      .toBeInTheDocument();
    expect(page.getByRole('button', { name: 'Download' }).elements()).toHaveLength(0);

    await page.getByRole('button', { name: 'Show Edit Options' }).click();
    await expect.element(page.getByRole('menuitem', { name: 'Download' })).toBeVisible();

    // The copy options are a submenu there
    await sleep(150);
    await page.getByRole('menuitem', { name: 'Copy' }).click();
    await expect.element(page.getByRole('menuitem', { name: 'Public URL' })).toBeVisible();
  });

  test('shows a loading state, then reports a missing asset', async () => {
    externalAssets.current = undefined;
    overlaidExternalAssetId.current = 'images/missing.png';

    await render(DetailsOverlay);
    await expect.element(page.getByRole('alert')).toHaveTextContent('Loading…');

    externalAssets.current = [...assets];
    await expect.element(page.getByText('File not found.')).toBeInTheDocument();
  });

  test('downloads and deletes the asset', async () => {
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

    const remove = vi.fn().mockResolvedValue(undefined);

    selectedCloudService.current = createMockCloudService({ delete: remove });
    overlaidExternalAssetId.current = 'images/notes.txt';

    try {
      await render(DetailsOverlay);
      await expect.element(page.getByRole('figure')).toHaveTextContent('Hello, world!');

      await page.getByRole('button', { name: 'Download' }).click();
      await expect.poll(() => clicks).toEqual(['notes.txt']);

      await page.getByRole('button', { name: 'Delete Asset' }).click();

      const dialog = page.getByRole('alertdialog');

      await expect.element(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Delete' }).click();
      await vi.waitFor(() => expect(remove).toHaveBeenCalledWith([assets[1]], expect.anything()));
      await expect.poll(() => window.location.hash).toBe('#/assets/-/test_cloud');
    } finally {
      click.mockRestore();
    }
  });

  test('reports a text file that can’t be fetched', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    externalAssets.current = [
      createMockExternalAsset({
        fileName: 'lost.txt',
        asset: { downloadURL: 'blob:http://localhost/missing' },
      }),
    ];
    overlaidExternalAssetId.current = 'images/lost.txt';

    await render(DetailsOverlay);
    await expect.element(page.getByRole('alert')).toHaveTextContent('Preview Unavailable.');
  });

  test('goes back to the service', async () => {
    overlaidExternalAssetId.current = 'images/a.png';

    await render(DetailsOverlay);
    await page.getByRole('button', { name: 'Cancel Editing' }).click();

    await expect.poll(() => window.location.hash).toBe('#/assets/-/test_cloud');
  });
});
