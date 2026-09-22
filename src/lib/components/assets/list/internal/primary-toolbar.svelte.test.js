import { tick } from 'svelte';
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { focusedAsset, selectedAssets } from '$lib/services/assets';
import { deleteAssets } from '$lib/services/assets/data/delete';
import { globalAssetFolder, selectedAssetFolder } from '$lib/services/assets/folders';
import { selectedSubfolderPath } from '$lib/services/assets/subfolders';
import { env } from '$lib/services/user/env.svelte';
import { forkedRepository } from '$lib/services/workflow/open-authoring';
import { createMockAsset, createMockImageFile, initTestConfig, setAssets } from '$lib/test/config';

import PrimaryToolbar from './primary-toolbar.svelte';

vi.mock('$lib/services/assets/data/delete', () => ({
  updateStores: vi.fn(),
  deleteAssets: vi.fn(),
}));

const assets = [createMockAsset({ name: 'a.png' }), createMockAsset({ name: 'b.png' })];
const [firstAsset, secondAsset] = assets;

describe('PrimaryToolbar', () => {
  beforeAll(async () => {
    await initTestConfig({ site_url: 'https://example.com' });
    firstAsset.file = await createMockImageFile({ name: 'a.png' });
    secondAsset.file = await createMockImageFile({ name: 'b.png' });
    setAssets(assets);
  });

  beforeEach(() => {
    env.isSmallScreen = false;
    selectedAssetFolder.current = undefined;
    selectedSubfolderPath.current = '';
    forkedRepository.current = undefined;
    focusedAsset.current = undefined;
    selectedAssets.current = [];
  });

  test('disables the asset actions until an asset is focused', async () => {
    await render(PrimaryToolbar);

    const toolbar = page.getByRole('toolbar', { name: 'Folder' });

    await expect.element(toolbar.getByRole('button', { name: 'Show Preview' })).toBeDisabled();
    await expect.element(toolbar.getByRole('button', { name: 'Copy' })).toBeDisabled();
    await expect.element(toolbar.getByRole('button', { name: 'Download' })).toBeDisabled();
    await expect.element(toolbar.getByRole('button', { name: /^Delete/ })).toBeDisabled();
    await expect.element(toolbar.getByRole('button', { name: 'Upload New Assets' })).toBeEnabled();

    focusedAsset.current = firstAsset;

    await expect.element(toolbar.getByRole('button', { name: 'Show Preview' })).toBeEnabled();
    await expect.element(toolbar.getByRole('button', { name: 'Copy' })).toBeEnabled();
    await expect.element(toolbar.getByRole('button', { name: 'Download' })).toBeEnabled();
    await expect
      .element(toolbar.getByRole('button', { name: 'Delete Selected Asset' }))
      .toBeEnabled();

    // A download is a click on a temporary link, which can’t be observed, so watch the link
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

    try {
      await toolbar.getByRole('button', { name: 'Download' }).click();
      await expect.poll(() => clicks).toEqual([firstAsset.name]);
    } finally {
      click.mockRestore();
    }
  });

  test('shows the folder name and deletes the selected assets', async () => {
    selectedAssetFolder.current = /** @type {any} */ ({
      collectionName: undefined,
      internalPath: 'static/uploads',
      publicPath: '/uploads',
      entryRelative: false,
      hasTemplateTags: false,
    });

    const { container } = await render(PrimaryToolbar);

    expect(container.querySelector('h2')).toHaveTextContent('Global Assets');

    // The selection is reset whenever the listed assets change, so select the assets afterwards
    await tick();
    selectedAssets.current = [...assets];

    await page.getByRole('button', { name: 'Delete Selected Assets' }).click();

    const dialog = page.getByRole('alertdialog');

    await expect
      .element(dialog)
      .toHaveTextContent(
        'Delete Assets Are you sure you want to delete all the assets? Delete Cancel',
      );
    await dialog.getByRole('button', { name: 'Delete' }).click();

    await vi.waitFor(() => expect(deleteAssets).toHaveBeenCalledWith(assets));
  });

  test('disables uploading and deleting while contributing via a fork', async () => {
    forkedRepository.current = /** @type {any} */ ({ owner: 'me', repo: 'site' });
    focusedAsset.current = firstAsset;

    await render(PrimaryToolbar);

    await expect.element(page.getByRole('button', { name: 'Upload New Assets' })).toBeDisabled();
    await expect
      .element(page.getByRole('button', { name: 'Delete Selected Asset' }))
      .toBeDisabled();
    await expect.element(page.getByRole('button', { name: 'Copy' })).toBeEnabled();
  });

  test('hides the upload button on a small screen while contributing via a fork', async () => {
    env.isSmallScreen = true;
    forkedRepository.current = /** @type {any} */ ({ owner: 'me', repo: 'site' });

    await render(PrimaryToolbar);

    expect(page.getByRole('button', { name: 'Upload New Assets' }).elements()).toHaveLength(0);
  });

  describe('in a subfolder', () => {
    // Give the breadcrumb room, or it folds its middle into a menu
    beforeAll(async () => {
      await page.viewport(1024, 768);
    });

    afterAll(async () => {
      await page.viewport(414, 896);
    });

    beforeEach(() => {
      selectedAssetFolder.current = globalAssetFolder.current;
      selectedSubfolderPath.current = '2024/summer';
      window.location.hash = '#/assets/static/uploads/2024/summer';
    });

    test('shows the subfolder in a breadcrumb, which leads back to an ancestor', async () => {
      const { container } = await render(PrimaryToolbar);

      expect(
        /** @type {HTMLElement} */ (container.querySelector('h2')).innerText
          .replace(/\s+/g, ' ')
          .trim(),
      ).toBe('Global Assets chevron_right 2024 chevron_right summer');
      await expect.element(page.getByRole('button', { name: 'New Folder' })).toBeEnabled();

      await page.getByRole('button', { name: '2024' }).click();
      await expect.poll(() => window.location.hash).toBe('#/assets/static/uploads/2024');
      expect(window.history.state.folder).toEqual(globalAssetFolder.current);

      await page.getByRole('button', { name: 'Global Assets' }).click();
      await expect.poll(() => window.location.hash).toBe('#/assets/static/uploads');
    });

    test('shows the folder alone at its root', async () => {
      selectedSubfolderPath.current = '';

      const { container } = await render(PrimaryToolbar);

      expect(container.querySelector('h2')).toHaveTextContent('Global Assets');
      expect(container.querySelectorAll('h2 button')).toHaveLength(0);
    });

    test('leads back to the parent folder on a small screen', async () => {
      env.isSmallScreen = true;

      const { container } = await render(PrimaryToolbar);

      expect(container.querySelector('h2')).toHaveTextContent('summer');

      await page.getByRole('button', { name: 'Back to Parent Folder' }).click();
      await expect.poll(() => window.location.hash).toBe('#/assets/static/uploads/2024');
    });
  });
});
