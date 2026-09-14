import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import {
  externalAssets,
  focusedExternalAsset,
  selectedCloudService,
  selectedExternalAssets,
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
    focusedExternalAsset.current = undefined;
    selectedExternalAssets.current = [];
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
