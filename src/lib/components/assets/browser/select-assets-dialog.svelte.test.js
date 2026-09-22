import { sleep } from '@sveltia/utils/misc';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { createSubfolder } from '$lib/services/assets/data/subfolder';
import { globalAssetFolder } from '$lib/services/assets/folders';
import { selectAssetsView, showContentOverlay } from '$lib/services/contents/editor';
import { duplicates } from '$lib/services/contents/fields/file/duplicates.svelte';
import {
  FRAME_ORIGIN as CLOUDINARY_ORIGIN,
  activated as cloudinaryActivated,
  dialogOpen as cloudinaryDialogOpen,
} from '$lib/services/integrations/media-libraries/cloud/cloudinary';
import { allStockAssetProviders } from '$lib/services/integrations/media-libraries/stock';
import { env } from '$lib/services/user/env.svelte';
import { prefs } from '$lib/services/user/prefs.svelte';
import {
  createMockAsset,
  createMockCloudService,
  createMockExternalAsset,
  createMockImageFile,
  initTestConfig,
  setAssets,
} from '$lib/test/config';

import SelectAssetsDialog from './select-assets-dialog.svelte';

vi.mock('$lib/services/assets/data/subfolder', async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  createSubfolder: vi.fn(),
}));

/**
 * @import { MediaLibraryService } from '$lib/types/private';
 */

/** @type {any[]} */
let assets = [];

/**
 * Get the option holding the given asset.
 * @param {string} value Option value.
 * @returns {import('vitest/browser').Locator} Locator.
 */
const getOption = (value) =>
  page.elementLocator(
    /** @type {HTMLElement} */ (document.querySelector(`[role="option"][data-value="${value}"]`)),
  );

/**
 * Render the dialog.
 * @param {Record<string, any>} [props] Props to override.
 * @param {Partial<MediaLibraryService>} [service] Cloud service properties.
 * @returns {Promise<{ props: any, onSelect: any, onClose: any }>} Props and handlers.
 */
const renderDialog = async (props = {}, service = {}) => {
  const onSelect = vi.fn();
  const onClose = vi.fn();

  const _props = $state({
    open: true,
    kind: /** @type {any} */ ('image'),
    fieldConfig: { name: 'image', widget: 'image' },
    assetLibraryFolderMap: { global: { folder: globalAssetFolder.current, enabled: true } },
    enabledCloudServiceEntries: [
      ['test_cloud', createMockCloudService({ list: vi.fn().mockResolvedValue([]), ...service })],
    ],
    onSelect,
    onClose,
    ...props,
  });

  await render(SelectAssetsDialog, /** @type {any} */ (_props));

  return { props: _props, onSelect, onClose };
};

/**
 * Drop the given files onto the dialog, the way a browser does when files are dropped from the
 * desktop: each item resolves to a file system entry.
 * @param {File[]} files Files.
 */
const dropFiles = (files) => {
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

  /** @type {HTMLElement} */ (document.querySelector('.drop-target')).dispatchEvent(event);
};

/**
 * Wait for the grid to be listed and activated.
 * @param {number} count Expected number of items.
 * @returns {Promise<void>}
 */
const waitForGrid = async (count) => {
  await expect
    .poll(() => document.querySelectorAll('#select-assets-grid [role="option"]').length)
    .toBe(count);
  // A Sveltia UI list box starts handling clicks 100 ms after it’s mounted
  await sleep(150);
};

describe('SelectAssetsDialog', () => {
  beforeEach(async () => {
    await initTestConfig({ media_libraries: { stock_assets: { providers: ['picsum'] } } });

    assets = [
      createMockAsset({
        name: 'a.png',
        file: await createMockImageFile({ name: 'a.png' }),
        asset: { folder: globalAssetFolder.current },
      }),
      createMockAsset({
        name: 'b.png',
        file: await createMockImageFile({ name: 'b.png' }),
        asset: { folder: globalAssetFolder.current },
      }),
      createMockAsset({
        name: 'c.txt',
        file: new File(['x'], 'c.txt', { type: 'text/plain' }),
        asset: { folder: globalAssetFolder.current },
      }),
    ];
    setAssets(assets);

    env.isSmallScreen = false;
    prefs.apiKeys = {};
    prefs.logins = {};
    selectAssetsView.current = { type: 'grid' };
    showContentOverlay.current = true;
  });

  test('lists the locations and the images in the global folder', async () => {
    const { onSelect } = await renderDialog();
    const dialog = page.getByRole('dialog', { name: 'Select Image' });

    await expect.element(dialog).toBeInTheDocument();

    const locations = dialog.getByRole('listbox', { name: 'Locations' });

    expect(
      locations
        .getByRole('option')
        .elements()
        // Each option has a start icon, and the selected option also has a check icon
        .map((el) => el.querySelector('.label')?.textContent?.trim()),
    ).toEqual(['Global Assets', 'Test Cloud', 'Enter URL', 'Lorem Picsum']);
    await expect
      .element(locations.getByRole('option', { name: 'Global Assets' }))
      .toHaveAttribute('aria-selected', 'true');
    await expect.element(dialog.getByRole('button', { name: 'Insert' })).toBeDisabled();

    // Only images are listed
    await waitForGrid(2);

    await getOption(assets[1].path).click();
    await expect.element(dialog.getByRole('button', { name: 'Insert' })).toBeEnabled();
    await dialog.getByRole('button', { name: 'Insert' }).click();

    await vi.waitFor(() =>
      expect(onSelect).toHaveBeenCalledWith([
        { asset: expect.objectContaining({ path: assets[1].path }) },
      ]),
    );
  });

  describe('with subfolders', () => {
    beforeEach(async () => {
      const folder = globalAssetFolder.current;

      assets.push(
        createMockAsset({
          name: 'd.png',
          folderPath: 'static/uploads/2024',
          file: await createMockImageFile({ name: 'd.png' }),
          asset: { folder },
        }),
        createMockAsset({
          name: 'e.png',
          folderPath: 'static/uploads/2024/summer',
          file: await createMockImageFile({ name: 'e.png' }),
          asset: { folder },
        }),
      );
      setAssets(assets);
    });

    test('browses the folder by subfolder, with a breadcrumb leading back', async () => {
      const { onSelect } = await renderDialog();
      const dialog = page.getByRole('dialog', { name: 'Select Image' });
      const folders = dialog.getByRole('list', { name: 'Folders' });

      // The folder root: the assets right in it, and its subfolders
      await waitForGrid(2);
      await expect.element(folders.getByRole('button', { name: '2024' })).toBeVisible();
      expect(folders.getByRole('listitem').elements()).toHaveLength(1);
      expect(dialog.getByRole('navigation').elements()).toHaveLength(0);

      await folders.getByRole('button', { name: '2024' }).click();
      await waitForGrid(1);
      expect(document.querySelector('#select-assets-grid [role="option"]')).toHaveAttribute(
        'data-value',
        'static/uploads/2024/d.png',
      );
      await expect.element(folders.getByRole('button', { name: 'summer' })).toBeVisible();

      const breadcrumb = dialog.getByRole('navigation', { name: 'Folder' });

      await expect.element(breadcrumb).toMatchTextContent('Global Assets chevron_right 2024');

      await folders.getByRole('button', { name: 'summer' }).click();
      await waitForGrid(1);
      await expect
        .element(breadcrumb)
        .toMatchTextContent('Global Assets chevron_right 2024 chevron_right summer');
      expect(dialog.getByRole('list', { name: 'Folders' }).elements()).toHaveLength(0);

      // An asset in a subfolder is picked like any other
      await getOption('static/uploads/2024/summer/e.png').click();
      await dialog.getByRole('button', { name: 'Insert' }).click();
      await vi.waitFor(() =>
        expect(onSelect).toHaveBeenCalledWith([
          { asset: expect.objectContaining({ path: 'static/uploads/2024/summer/e.png' }) },
        ]),
      );
    });

    test('goes back through the breadcrumb, and searches the whole folder', async () => {
      await renderDialog();

      const dialog = page.getByRole('dialog', { name: 'Select Image' });
      const folders = dialog.getByRole('list', { name: 'Folders' });

      await waitForGrid(2);
      await folders.getByRole('button', { name: '2024' }).click();
      await waitForGrid(1);
      await folders.getByRole('button', { name: 'summer' }).click();
      await waitForGrid(1);

      await dialog.getByRole('navigation').getByRole('button', { name: '2024' }).click();
      await waitForGrid(1);
      await expect.element(folders.getByRole('button', { name: 'summer' })).toBeVisible();

      await dialog.getByRole('navigation').getByRole('button', { name: 'Global Assets' }).click();
      await waitForGrid(2);
      expect(dialog.getByRole('navigation').elements()).toHaveLength(0);

      // A search looks through every subfolder, listing the matches with their paths
      await page.getByRole('searchbox', { name: 'Search for Images' }).fill('e');
      await waitForGrid(1);
      expect(document.querySelector('#select-assets-grid .name')).toHaveTextContent(
        '2024/summer/e.png',
      );
      expect(dialog.getByRole('list', { name: 'Folders' }).elements()).toHaveLength(0);
    });

    test('creates a folder where the user is, and uploads there', async () => {
      vi.mocked(createSubfolder).mockResolvedValue(undefined);

      const { onSelect } = await renderDialog();
      const dialog = page.getByRole('dialog', { name: 'Select Image' });

      await waitForGrid(2);
      await dialog
        .getByRole('list', { name: 'Folders' })
        .getByRole('button', { name: '2024' })
        .click();
      await waitForGrid(1);

      await dialog.getByRole('button', { name: 'New Folder' }).click();

      const newFolder = page.getByRole('dialog', { name: 'New Folder' });

      await expect
        .element(
          newFolder.getByText(
            'The new folder will be created in “\u2068/static/uploads/2024\u2069”.',
          ),
        )
        .toBeVisible();
      // The names in the browsed directory are taken
      await newFolder.getByRole('textbox', { name: 'Folder Name' }).fill('summer');
      await expect.element(newFolder.getByRole('button', { name: 'Create' })).toBeDisabled();
      await newFolder.getByRole('textbox', { name: 'Folder Name' }).fill('autumn');
      await newFolder.getByRole('button', { name: 'Create' }).click();
      await vi.waitFor(() =>
        expect(createSubfolder).toHaveBeenCalledWith('static/uploads/2024/autumn'),
      );

      // A dropped file goes to the subfolder being browsed
      const file = await createMockImageFile({ name: 'new.png' });

      dropFiles([file]);
      await waitForGrid(2);
      await dialog.getByRole('button', { name: 'Insert' }).click();

      await vi.waitFor(() =>
        expect(onSelect).toHaveBeenCalledWith([
          { file, folder: globalAssetFolder.current, subfolderPath: '2024', replace: false },
        ]),
      );
    });

    test('lists the folder root again once another location has been picked', async () => {
      await renderDialog();

      const dialog = page.getByRole('dialog', { name: 'Select Image' });
      const locations = dialog.getByRole('listbox', { name: 'Locations' });

      await waitForGrid(2);
      await dialog
        .getByRole('list', { name: 'Folders' })
        .getByRole('button', { name: '2024' })
        .click();
      await waitForGrid(1);

      await locations.getByRole('option', { name: 'Enter URL' }).click();
      await locations.getByRole('option', { name: 'Global Assets' }).click();
      await waitForGrid(2);
      expect(dialog.getByRole('navigation').elements()).toHaveLength(0);
    });
  });

  test('filters the listed assets', async () => {
    await renderDialog();
    await waitForGrid(2);

    await page.getByRole('searchbox', { name: 'Search for Images' }).fill('B');
    await waitForGrid(1);
    expect(document.querySelector('#select-assets-grid [role="option"]')).toHaveAttribute(
      'data-value',
      assets[1].path,
    );
  });

  test('accepts a URL', async () => {
    const { onSelect } = await renderDialog({ kind: undefined });
    const dialog = page.getByRole('dialog', { name: 'Select File' });

    await sleep(150);
    await dialog.getByRole('option', { name: 'Enter URL' }).click();
    await expect.element(dialog.getByText('Enter URL of the file:')).toBeInTheDocument();

    await dialog.getByRole('textbox').fill(' https://example.com/x.pdf ');
    await dialog.getByRole('button', { name: 'Insert' }).click();

    await vi.waitFor(() =>
      expect(onSelect).toHaveBeenCalledWith([{ url: 'https://example.com/x.pdf' }]),
    );
  });

  test('asks for the URL of an image, and needs one to insert', async () => {
    const { props } = await renderDialog({ canEnterURL: false });
    const dialog = page.getByRole('dialog', { name: 'Select Image' });

    // The URL entry can be turned off
    await sleep(150);
    expect(dialog.getByRole('option', { name: 'Enter URL' }).elements()).toHaveLength(0);

    props.canEnterURL = true;
    await dialog.getByRole('option', { name: 'Enter URL' }).click();
    await expect.element(dialog.getByText('Enter URL of the image:')).toBeInTheDocument();

    const insert = dialog.getByRole('button', { name: 'Insert' });

    await dialog.getByRole('textbox').fill('https://example.com/x.png');
    await expect.element(insert).toBeEnabled();
    await dialog.getByRole('textbox').fill(' ');
    await expect.element(insert).toBeDisabled();
  });

  test('lists the assets on a cloud storage service', async () => {
    const list = vi.fn().mockResolvedValue([createMockExternalAsset({ fileName: 'cloud.png' })]);
    const { onSelect } = await renderDialog({}, { list });
    const dialog = page.getByRole('dialog');

    await sleep(150);
    await dialog.getByRole('option', { name: 'Test Cloud' }).click();
    await waitForGrid(1);
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ kind: 'image' }));

    await getOption('images/cloud.png').click();
    await dialog.getByRole('button', { name: 'Insert' }).click();

    await vi.waitFor(() =>
      expect(onSelect).toHaveBeenCalledWith([
        { url: 'https://cdn.example.com/images/cloud.png', credit: undefined },
      ]),
    );
  });

  test('creates a folder on a cloud storage service that has folders', async () => {
    const createFolder = vi.fn().mockResolvedValue(undefined);

    const browse = vi.fn().mockResolvedValue({
      assets: [createMockExternalAsset({ fileName: 'cloud.png' })],
      folders: [],
    });

    await renderDialog({}, { list: vi.fn(), browse, createFolder });

    const dialog = page.getByRole('dialog');

    // The button is for the repository folder until a cloud service is picked
    await expect.element(dialog.getByRole('button', { name: 'New Folder' })).toBeInTheDocument();
    await sleep(150);
    await dialog.getByRole('option', { name: 'Test Cloud' }).click();
    await expect.element(page.getByRole('list', { name: 'Folders' })).toMatchTextContent('images');
    await dialog.getByRole('button', { name: 'New Folder' }).click();

    const nameDialog = page.getByRole('dialog', { name: 'New Folder' });

    await expect.element(nameDialog).toMatchTextContent('created in “\u2068Test Cloud\u2069”');
    await nameDialog.getByRole('textbox').fill('docs');
    await nameDialog.getByRole('button', { name: 'Create' }).click();

    await vi.waitFor(() => expect(createFolder).toHaveBeenCalledWith('docs', expect.anything()));
    await expect
      .element(page.getByRole('list', { name: 'Folders' }))
      .toMatchTextContent(/docs.*images/);
  });

  test('shows the credit for a stock photo service', async () => {
    await renderDialog();

    await sleep(150);
    await page.getByRole('option', { name: 'Lorem Picsum' }).click();

    await expect
      .element(page.getByRole('link', { name: 'Photos provided by \u2068Lorem Picsum\u2069' }))
      .toHaveAttribute('href', 'https://picsum.photos/');
    // Picsum supports no search
    expect(page.getByRole('searchbox').elements()).toHaveLength(0);
  });

  test('shows the credit for a stock photo service once its API key is set', async () => {
    await initTestConfig({ media_libraries: { stock_assets: { providers: ['pexels'] } } });
    await renderDialog();

    await sleep(150);
    await page.getByRole('option', { name: 'Pexels' }).click();
    await expect.element(page.getByRole('textbox', { name: /API Key/ })).toBeVisible();
    expect(page.getByRole('link', { name: /Photos provided by/ }).elements()).toHaveLength(0);

    prefs.apiKeys = { pexels: 'key' };
    await expect
      .element(page.getByRole('link', { name: 'Photos provided by \u2068Pexels\u2069' }))
      .toBeVisible();
  });

  test('shows no credit for a stock photo service that doesn’t ask for one', async () => {
    const { picsum } = allStockAssetProviders;

    allStockAssetProviders.picsum = { ...picsum, showServiceLink: false };

    try {
      await renderDialog();

      await sleep(150);
      await page.getByRole('option', { name: 'Lorem Picsum' }).click();
      await expect
        .element(page.getByRole('option', { name: 'Lorem Picsum' }))
        .toHaveAttribute('aria-selected', 'true');
      expect(page.getByRole('link', { name: /Photos provided by/ }).elements()).toHaveLength(0);
    } finally {
      allStockAssetProviders.picsum = picsum;
    }
  });

  test('leaves out the disabled folders, the stock photos and the view switcher', async () => {
    await initTestConfig({ media_libraries: { stock_assets: { providers: [] } } });
    selectAssetsView.current = undefined;

    await renderDialog({
      assetLibraryFolderMap: {
        global: { folder: globalAssetFolder.current, enabled: true },
        entry: { folder: undefined, enabled: false },
      },
    });

    const dialog = page.getByRole('dialog');

    await expect.element(dialog.getByRole('option', { name: 'Global Assets' })).toBeVisible();
    expect(dialog.getByRole('option', { name: 'Entry Assets' }).elements()).toHaveLength(0);
    expect(dialog.getByRole('group', { name: 'Stock Photos' }).elements()).toHaveLength(0);
    expect(dialog.getByRole('button', { name: /View/ }).elements()).toHaveLength(0);
  });

  test('adds dropped files as unsaved assets', async () => {
    const { onSelect } = await renderDialog();
    const dialog = page.getByRole('dialog');

    await waitForGrid(2);

    const file = await createMockImageFile({ name: 'new.png' });

    dropFiles([file]);

    // The new asset is listed first and selected
    await waitForGrid(3);
    await expect
      .element(
        page.elementLocator(
          /** @type {HTMLElement} */ (
            document.querySelector('#select-assets-grid [role="option"]')
          ),
        ),
      )
      .toHaveAttribute('aria-selected', 'true');
    await expect.element(page.getByText('Unsaved')).toBeInTheDocument();

    await dialog.getByRole('button', { name: 'Insert' }).click();

    await vi.waitFor(() =>
      expect(onSelect).toHaveBeenCalledWith([
        { file, folder: globalAssetFolder.current, subfolderPath: '', replace: false },
      ]),
    );
    // The very same `File` object is passed on, not a clone that would have to be read again
    expect(onSelect.mock.calls[0][0][0].file).toBe(file);
  });

  test('asks whether to replace a dropped file that already exists', async () => {
    const { onSelect } = await renderDialog();
    const dialog = page.getByRole('dialog');

    await waitForGrid(2);

    // A file with the same content as one already dropped is ignored
    const [image, copy] = await Promise.all([
      createMockImageFile({ name: 'new.png' }),
      createMockImageFile({ name: 'copy.png' }),
    ]);

    dropFiles([image, copy]);
    await waitForGrid(3);
    dropFiles([image]);
    await sleep(100);
    expect(document.querySelectorAll('#select-assets-grid [role="option"]')).toHaveLength(3);

    // A file with the same name as a listed asset needs confirmation, which can be declined
    const duplicate = await createMockImageFile({ name: 'a.png', width: 5 });

    dropFiles([duplicate]);
    await expect.poll(() => duplicates.showDialog).toBe(true);
    duplicates.resolve?.(undefined);
    await expect.poll(() => duplicates.showDialog).toBe(false);
    await sleep(100);
    expect(document.querySelectorAll('#select-assets-grid [role="option"]')).toHaveLength(3);

    dropFiles([duplicate]);
    await expect.poll(() => duplicates.showDialog).toBe(true);
    duplicates.resolve?.(true);
    // The new file takes the place of the existing asset in the list
    await expect.poll(() => document.querySelectorAll('.unsaved').length).toBe(1);
    await waitForGrid(3);

    await dialog.getByRole('button', { name: 'Insert' }).click();
    await vi.waitFor(() =>
      expect(onSelect).toHaveBeenCalledWith([
        { file: duplicate, folder: globalAssetFolder.current, subfolderPath: '', replace: true },
      ]),
    );
  });

  test('uploads the chosen or pending files to the cloud service', async () => {
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});

    const upload = vi.fn(async (/** @type {File[]} */ files) =>
      files.map((file) => createMockExternalAsset({ fileName: file.name })),
    );

    try {
      const pending = await createMockImageFile({ name: 'pending.png' });

      // With no folder to choose from, the service that can take the files is selected right away
      const { props } = await renderDialog(
        {
          pendingFiles: [pending],
          assetLibraryFolderMap: { global: { folder: globalAssetFolder.current, enabled: false } },
          draft: { originalEntry: undefined, files: {} },
        },
        { list: vi.fn().mockResolvedValue([]), upload },
      );

      const dialog = page.getByRole('dialog');

      await expect
        .element(dialog.getByRole('option', { name: 'Test Cloud' }))
        .toHaveAttribute('aria-selected', 'true');
      // The pending files are uploaded once the panel is shown
      await vi.waitFor(() => expect(upload).toHaveBeenCalledWith([pending], expect.anything()));
      expect(props.pendingFiles).toEqual([]);

      // The file picker uploads to the service too
      await dialog.getByRole('button', { name: 'Upload' }).click();
      expect(click).toHaveBeenCalledOnce();

      const input = /** @type {HTMLInputElement} */ (click.mock.instances[0]);
      const chosen = await createMockImageFile({ name: 'chosen.png' });
      const dataTransfer = new DataTransfer();

      dataTransfer.items.add(chosen);
      input.files = dataTransfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await vi.waitFor(() => expect(upload).toHaveBeenCalledWith([chosen], expect.anything()));
    } finally {
      click.mockRestore();
    }
  });

  test('selects the first external service when no folder is available', async () => {
    await renderDialog({
      assetLibraryFolderMap: { global: { folder: globalAssetFolder.current, enabled: false } },
    });

    await expect
      .element(page.getByRole('dialog').getByRole('option', { name: 'Lorem Picsum' }))
      .toHaveAttribute('aria-selected', 'true');
  });

  test('falls back to a stock photo service for pending files without a cloud service', async () => {
    await renderDialog({
      assetLibraryFolderMap: { global: { folder: globalAssetFolder.current, enabled: false } },
      enabledCloudServiceEntries: [],
      pendingFiles: [await createMockImageFile({ name: 'pending.png' })],
    });

    await expect
      .element(page.getByRole('dialog').getByRole('option', { name: 'Lorem Picsum' }))
      .toHaveAttribute('aria-selected', 'true');
  });

  test('opens the Cloudinary library, and closes once assets are picked', async () => {
    await initTestConfig({
      media_libraries: {
        cloudinary: { config: { cloud_name: 'demo', api_key: '123' } },
      },
    });
    cloudinaryActivated.current = true;
    cloudinaryDialogOpen.current = false;
    vi.spyOn(console, 'debug').mockImplementation(() => {});

    try {
      const { props, onSelect } = await renderDialog({
        enabledCloudServiceEntries: [
          [
            'cloudinary',
            createMockCloudService({ serviceId: 'cloudinary', serviceLabel: 'Cloudinary' }),
          ],
        ],
      });

      const dialog = page.getByRole('dialog');

      await sleep(150);
      await dialog.getByRole('option', { name: 'Cloudinary' }).click();
      expect(cloudinaryDialogOpen.current).toBe(true);

      window.dispatchEvent(
        new MessageEvent('message', {
          origin: CLOUDINARY_ORIGIN,
          data: {
            type: 'ML_WIDGET_INSERT_DATA',
            data: { assets: [{ secure_url: 'https://res.cloudinary.com/demo/a.png' }] },
          },
        }),
      );

      await vi.waitFor(() =>
        expect(onSelect).toHaveBeenCalledWith([{ url: 'https://res.cloudinary.com/demo/a.png' }]),
      );
      expect(props.open).toBe(false);
    } finally {
      cloudinaryActivated.current = false;
    }
  });

  test('opens the file picker to upload', async () => {
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});

    try {
      await renderDialog();
      await waitForGrid(2);
      await page.getByRole('dialog').getByRole('button', { name: 'Upload' }).click();

      expect(click).toHaveBeenCalledOnce();

      const input = /** @type {HTMLInputElement} */ (click.mock.instances[0]);

      expect(input.accept).toContain('image/png');

      // The chosen files are added just like dropped ones
      const dataTransfer = new DataTransfer();

      dataTransfer.items.add(await createMockImageFile({ name: 'chosen.png' }));
      input.files = dataTransfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await waitForGrid(3);
    } finally {
      click.mockRestore();
    }
  });

  test('resets the state when closed, and closes with the editor', async () => {
    const { props, onClose } = await renderDialog();
    const dialog = page.getByRole('dialog');

    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(props.open).toBe(false);

    props.open = true;
    await expect.element(page.getByRole('dialog')).toBeInTheDocument();

    showContentOverlay.current = false;
    await expect.poll(() => props.open).toBe(false);
  });

  test('uses a select on a small screen', async () => {
    env.isSmallScreen = true;

    await renderDialog();

    const dialog = page.getByRole('dialog');

    await expect.element(dialog.getByRole('combobox', { name: 'Locations' })).toBeInTheDocument();
    expect(dialog.getByRole('listbox', { name: 'Locations' }).elements()).toHaveLength(0);
  });
});
