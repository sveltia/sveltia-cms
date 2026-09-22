import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import {
  externalAssets,
  externalAssetSearchTerms,
  focusedExternalAsset,
  selectedCloudService,
  selectedExternalAssets,
  selectedExternalDirPath,
} from '$lib/services/assets/external';
import { env } from '$lib/services/user/env.svelte';
import { createMockCloudService, createMockExternalAsset } from '$lib/test/config';

import PrimaryToolbar from './primary-toolbar.svelte';

const assets = [
  createMockExternalAsset({ fileName: 'a.png' }),
  createMockExternalAsset({ fileName: 'b.png' }),
];

const [firstAsset] = assets;

describe('PrimaryToolbar', () => {
  beforeEach(() => {
    env.isSmallScreen = false;
    externalAssets.current = [...assets];
    externalAssetSearchTerms.current = '';
    selectedExternalDirPath.current = '';
    focusedExternalAsset.current = undefined;
    selectedExternalAssets.current = [];
  });

  test('shows a breadcrumb leading back from the folder being browsed', async () => {
    // Give the breadcrumb room, or it folds its middle into a menu
    await page.viewport(1024, 768);

    selectedCloudService.current = createMockCloudService({
      browse: vi.fn(),
      upload: vi.fn(),
      createFolder: vi.fn(),
    });
    selectedExternalDirPath.current = '2024/summer';

    const { container } = await render(PrimaryToolbar);
    const toolbar = page.getByRole('toolbar', { name: 'Folder' });
    const breadcrumb = toolbar.getByRole('navigation', { name: 'Folder' });

    expect(container.querySelector('h2')).toMatchTextContent(/Test Cloud.*2024.*summer/);
    await expect.element(toolbar.getByRole('button', { name: 'New Folder' })).toBeEnabled();

    await breadcrumb.getByRole('button', { name: '2024' }).click();
    expect(selectedExternalDirPath.current).toBe('2024');
    expect(container.querySelector('h2')).toMatchTextContent(/Test Cloud.*2024/);

    await breadcrumb.getByRole('button', { name: 'Test Cloud' }).click();
    expect(selectedExternalDirPath.current).toBe('');
    expect(container.querySelector('h2')).toHaveTextContent('Test Cloud');
    expect(toolbar.getByRole('navigation').elements()).toHaveLength(0);

    // A search looks through the whole service, so the trail is left out meanwhile
    selectedExternalDirPath.current = '2024';
    await expect.element(toolbar.getByRole('navigation')).toBeInTheDocument();
    externalAssetSearchTerms.current = 'photo';
    await expect.poll(() => toolbar.getByRole('navigation').elements()).toEqual([]);
    expect(container.querySelector('h2')).toHaveTextContent('Test Cloud');
    expect(toolbar.getByRole('button', { name: 'New Folder' }).elements()).toHaveLength(0);

    await page.viewport(414, 896);
  });

  test('goes back to the parent folder with the back button on a small screen', async () => {
    env.isSmallScreen = true;
    selectedCloudService.current = createMockCloudService({ browse: vi.fn() });
    selectedExternalDirPath.current = '2024/summer';

    const { container } = await render(PrimaryToolbar);

    expect(container.querySelector('h2')).toHaveTextContent('summer');

    await page.getByRole('button', { name: 'Back to Parent Folder' }).click();
    expect(selectedExternalDirPath.current).toBe('2024');

    await page.getByRole('button', { name: 'Back to Parent Folder' }).click();
    expect(selectedExternalDirPath.current).toBe('');
    await expect
      .element(page.getByRole('button', { name: 'Back to Asset Folder List' }))
      .toBeInTheDocument();
  });

  test('shows the service name and all the actions it supports', async () => {
    const deleteAssets = vi.fn().mockResolvedValue(undefined);

    selectedCloudService.current = createMockCloudService({
      upload: vi.fn(),
      delete: deleteAssets,
      rename: vi.fn(),
    });

    const { container } = await render(PrimaryToolbar);
    const toolbar = page.getByRole('toolbar', { name: 'Folder' });

    expect(container.querySelector('h2')).toHaveTextContent('Test Cloud');
    await expect.element(toolbar.getByRole('button', { name: 'Show Preview' })).toBeDisabled();
    await expect.element(toolbar.getByRole('button', { name: 'Copy' })).toBeDisabled();
    await expect.element(toolbar.getByRole('button', { name: 'Download' })).toBeDisabled();
    await expect.element(toolbar.getByRole('button', { name: /^Delete/ })).toBeDisabled();
    await expect.element(toolbar.getByRole('button', { name: 'Show Edit Options' })).toBeEnabled();
    await expect.element(toolbar.getByRole('button', { name: 'Upload New Assets' })).toBeEnabled();

    // The focused asset alone is acted on until some are selected
    focusedExternalAsset.current = firstAsset;
    await expect
      .element(toolbar.getByRole('button', { name: 'Delete Selected Asset' }))
      .toBeEnabled();
    selectedExternalAssets.current = [...assets];

    await expect.element(toolbar.getByRole('button', { name: 'Show Preview' })).toBeEnabled();
    await expect.element(toolbar.getByRole('button', { name: 'Copy' })).toBeEnabled();

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

    const textURL = URL.createObjectURL(new Blob(['x'], { type: 'text/plain' }));

    assets.forEach((asset) => {
      asset.downloadURL = textURL;
    });

    try {
      await toolbar.getByRole('button', { name: 'Download' }).click();
      await expect.poll(() => clicks).toEqual(assets.map(({ fileName }) => fileName));
    } finally {
      click.mockRestore();
    }

    await toolbar.getByRole('button', { name: 'Delete Selected Assets' }).click();

    const dialog = page.getByRole('alertdialog');

    await expect
      .element(dialog)
      .toHaveTextContent(
        'Delete Assets Are you sure you want to delete all the assets? Delete Cancel',
      );
    await dialog.getByRole('button', { name: 'Delete' }).click();

    await vi.waitFor(() => expect(deleteAssets).toHaveBeenCalledWith(assets, expect.anything()));
    // The list is updated without reloading
    await expect.poll(() => externalAssets.current).toEqual([]);
  });

  test('hides the controls for operations the service doesn’t support', async () => {
    selectedCloudService.current = createMockCloudService();

    await render(PrimaryToolbar);

    await expect.element(page.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
    expect(page.getByRole('button', { name: /^Delete/ }).elements()).toHaveLength(0);
    expect(page.getByRole('button', { name: 'Show Edit Options' }).elements()).toHaveLength(0);
    expect(page.getByRole('button', { name: 'Upload New Assets' }).elements()).toHaveLength(0);
  });

  test('hides the upload button on a small screen until the list is loaded', async () => {
    env.isSmallScreen = true;
    externalAssets.current = undefined;
    selectedCloudService.current = createMockCloudService({ upload: vi.fn() });

    await render(PrimaryToolbar);

    expect(page.getByRole('button', { name: 'Upload New Assets' }).elements()).toHaveLength(0);

    externalAssets.current = [...assets];
    await expect
      .element(page.getByRole('button', { name: 'Upload New Assets' }))
      .toBeInTheDocument();
  });
});
