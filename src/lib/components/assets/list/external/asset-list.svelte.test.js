import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import {
  externalAssets,
  externalAssetsError,
  selectedCloudService,
} from '$lib/services/assets/external';
import { uploadingExternalAssets } from '$lib/services/assets/external/data';
import { currentView } from '$lib/services/assets/view/settings';
import {
  FRAME_ORIGIN as CLOUDINARY_ORIGIN,
  activated as cloudinaryActivated,
  dialogOpen as cloudinaryDialogOpen,
} from '$lib/services/integrations/media-libraries/cloud/cloudinary';
import { prefs } from '$lib/services/user/prefs.svelte';
import { createMockCloudService, createMockExternalAsset } from '$lib/test/config';

import AssetList from './asset-list.svelte';

const assets = [
  createMockExternalAsset({ fileName: 'a.png' }),
  createMockExternalAsset({ fileName: 'b.png' }),
];

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

describe('AssetList', () => {
  beforeEach(() => {
    prefs.apiKeys = {};
    prefs.logins = {};
    currentView.current = { type: 'grid' };
    selectedCloudService.current = createMockCloudService({ upload: vi.fn() });
    externalAssets.current = [...assets];
    externalAssetsError.current = undefined;
    uploadingExternalAssets.current = { files: [] };
  });

  test('lists the assets, accepting dropped files', async () => {
    const { container } = await render(AssetList);
    const grid = page.getByRole('grid', { name: 'Assets' });

    await expect.element(grid).toHaveAttribute('aria-rowcount', '2');
    await expect.element(grid.getByRole('row', { name: 'a.png' })).toBeInTheDocument();
    await expect.element(grid.getByRole('row', { name: 'b.png' })).toBeInTheDocument();

    const file = new File(['x'], 'c.png', { type: 'image/png' });

    /** @type {HTMLElement} */ (container.querySelector('.drop-target')).dispatchEvent(
      createDropEvent([file]),
    );

    await expect.poll(() => uploadingExternalAssets.current.files).toEqual([file]);
  });

  test('offers to upload when the service is empty', async () => {
    externalAssets.current = [];

    await render(AssetList);

    await expect.element(page.getByText('No files found.')).toBeInTheDocument();
    await expect
      .element(page.getByRole('button', { name: 'Upload New Assets' }))
      .toBeInTheDocument();
  });

  test('doesn’t offer to upload when the service doesn’t support it', async () => {
    selectedCloudService.current = createMockCloudService();
    externalAssets.current = [];

    await render(AssetList);

    await expect.element(page.getByText('No files found.')).toBeInTheDocument();
    expect(page.getByRole('button').elements()).toHaveLength(0);
  });

  test('shows a loading state until the list is fetched', async () => {
    externalAssets.current = undefined;

    await render(AssetList);
    await expect.element(page.getByRole('alert')).toHaveTextContent('Loading…');

    externalAssets.current = [...assets];
    await expect.element(page.getByRole('grid')).toBeInTheDocument();
  });

  test('asks for the credentials when missing or rejected', async () => {
    selectedCloudService.current = createMockCloudService({
      authType: 'api_key',
      apiKeyPattern: /^[a-z]+$/,
    });

    const { container } = await render(AssetList);

    await expect.element(page.getByRole('textbox')).toBeInTheDocument();
    expect(container.querySelector('.error')).toBeNull();

    prefs.apiKeys = { test_cloud: 'secret' };
    externalAssetsError.current = 'search_fetch_failed';

    await expect
      .element(page.getByRole('alert').first())
      .toHaveTextContent('There was an error while searching assets. Please try again later.');
    await expect.element(page.getByRole('textbox')).toBeInTheDocument();
  });

  test('leaves the list to the service’s own widget', async () => {
    selectedCloudService.current = createMockCloudService({ authType: 'widget' });

    await render(AssetList);

    await expect.element(page.getByRole('group', { name: 'Asset List' })).toBeInTheDocument();
    expect(page.getByRole('grid').elements()).toHaveLength(0);
    expect(page.getByRole('textbox').elements()).toHaveLength(0);

    // Cloudinary comes with a widget of its own
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    selectedCloudService.current = createMockCloudService({
      authType: 'widget',
      serviceId: 'cloudinary',
    });
    await expect.element(page.getByRole('button', { name: 'Activate Cloudinary' })).toBeVisible();

    // The widget lists the assets itself, so a selection made there is of no interest here
    cloudinaryActivated.current = true;
    cloudinaryDialogOpen.current = true;
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: CLOUDINARY_ORIGIN,
        data: {
          type: 'ML_WIDGET_INSERT_DATA',
          data: { assets: [{ secure_url: 'https://res.cloudinary.com/demo/a.png' }] },
        },
      }),
    );
    await expect.poll(() => cloudinaryDialogOpen.current).toBe(false);
    cloudinaryActivated.current = false;
  });
});
