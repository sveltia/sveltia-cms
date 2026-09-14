import { sleep } from '@sveltia/utils/misc';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { selectAssetsView } from '$lib/services/contents/editor';
import { env } from '$lib/services/user/env.svelte';
import { prefs } from '$lib/services/user/prefs.svelte';
import {
  createMockCloudService,
  createMockExternalAsset,
  createMockImageFile,
  initTestConfig,
} from '$lib/test/config';

import ExternalAssetsPanel from './external-assets-panel.svelte';

const assets = [
  createMockExternalAsset({ fileName: 'a.png' }),
  createMockExternalAsset({ fileName: 'b.png' }),
];

/**
 * Get the option holding the given asset.
 * @param {string} id Asset ID.
 * @returns {import('vitest/browser').Locator} Locator.
 */
const getOption = (id) =>
  page.elementLocator(
    /** @type {HTMLElement} */ (document.querySelector(`[role="option"][data-value="${id}"]`)),
  );

/**
 * Wait for the list to be rendered.
 * @param {number} count Expected number of items.
 * @returns {Promise<void>}
 */
const waitForList = async (count) => {
  await expect.poll(() => page.getByRole('option').elements().length).toBe(count);
  // A Sveltia UI list box starts handling clicks 100 ms after it’s mounted
  await sleep(150);
};

describe('ExternalAssetsPanel', () => {
  beforeEach(async () => {
    await initTestConfig({ media_libraries: { all: { max_file_size: 1000 } } });
    env.isSmallScreen = false;
    prefs.apiKeys = {};
    prefs.logins = {};
    selectAssetsView.current = { type: 'grid' };
  });

  test('lists the assets and selects one by hotlinking', async () => {
    const list = vi.fn().mockResolvedValue(assets);

    const props = $state({
      kind: /** @type {const} */ ('image'),
      serviceProps: createMockCloudService({ list }),
      selectedResources: /** @type {any[]} */ ([]),
    });

    const { container } = await render(ExternalAssetsPanel, props);

    await waitForList(2);
    expect(list).toHaveBeenCalledWith({
      kind: 'image',
      fieldConfig: undefined,
      apiKey: '',
      userName: '',
      password: '',
    });
    // A cloud storage service shows the file path
    expect(container.querySelector('.name strong')).toHaveTextContent('a.png');

    await getOption('images/a.png').click();
    await expect
      .poll(() => props.selectedResources)
      .toEqual([{ url: 'https://cdn.example.com/images/a.png', credit: undefined }]);
    await expect.element(getOption('images/a.png')).toHaveAttribute('aria-selected', 'true');

    // Another selection replaces the previous one
    await getOption('images/b.png').click();
    await expect
      .poll(() => props.selectedResources)
      .toEqual([{ url: 'https://cdn.example.com/images/b.png', credit: undefined }]);
  });

  test('downloads the selected file when hotlinking is not allowed', async () => {
    const url = URL.createObjectURL(await createMockImageFile());

    const asset = createMockExternalAsset({
      fileName: 'photo.png',
      asset: { downloadURL: url, previewURL: url, credit: 'Photo by Melvin' },
    });

    const props = $state({
      serviceProps: createMockCloudService({
        hotlinking: false,
        list: vi.fn().mockResolvedValue([asset]),
      }),
      selectedResources: /** @type {any[]} */ ([]),
    });

    await render(ExternalAssetsPanel, props);
    await waitForList(1);
    await getOption('images/photo.png').click();

    await expect.poll(() => props.selectedResources.length).toBe(1);

    const [{ url: resourceURL, credit, file }] = props.selectedResources;

    expect(resourceURL).toBe(url);
    expect(credit).toBe('Photo by Melvin');
    expect(file.name).toBe('photo.png');
    expect(file.type).toBe('image/png');
  });

  test('reports a download failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const asset = createMockExternalAsset({
      fileName: 'photo.png',
      asset: { downloadURL: 'blob:http://localhost/missing' },
    });

    const props = $state({
      serviceProps: createMockCloudService({
        hotlinking: false,
        list: vi.fn().mockResolvedValue([asset]),
      }),
      selectedResources: /** @type {any[]} */ ([]),
    });

    await render(ExternalAssetsPanel, props);
    await waitForList(1);
    await getOption('images/photo.png').click();

    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent(
        'There was an error while downloading the selected asset. Please try again later.',
      );
    expect(props.selectedResources).toEqual([]);
  });

  test('searches the assets', async () => {
    const list = vi.fn().mockResolvedValue(assets);
    const search = vi.fn().mockResolvedValue([assets[1]]);

    const props = $state({
      serviceProps: createMockCloudService({ list, search }),
      searchTerms: '',
      selectedResources: /** @type {any[]} */ ([]),
    });

    await render(ExternalAssetsPanel, props);
    await waitForList(2);

    props.searchTerms = ' b ';
    await expect.element(page.getByRole('alert')).toHaveTextContent('Searching…');
    await waitForList(1);
    expect(search).toHaveBeenCalledWith('b', expect.anything());

    search.mockResolvedValue([]);
    props.searchTerms = 'c';
    await expect.element(page.getByRole('alert')).toHaveTextContent('No files found.');
  });

  test('reports a listing failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await render(
      ExternalAssetsPanel,
      /** @type {any} */ ({
        serviceProps: createMockCloudService({
          list: vi.fn().mockRejectedValue(new Error('Boom')),
        }),
      }),
    );

    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('There was an error while searching assets. Please try again later.');
  });

  test('asks for the credentials first', async () => {
    const list = vi.fn().mockResolvedValue(assets);

    await render(
      ExternalAssetsPanel,
      /** @type {any} */ ({
        serviceProps: createMockCloudService({
          authType: 'api_key',
          apiKeyPattern: /^[a-z]+$/,
          list,
        }),
      }),
    );

    expect(list).not.toHaveBeenCalled();

    await page.getByRole('textbox').fill('secret');
    await waitForList(2);
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ apiKey: 'secret' }));
    expect(prefs.apiKeys?.test_cloud).toBe('secret');
  });

  test('reports a service that isn’t configured', async () => {
    await render(
      ExternalAssetsPanel,
      /** @type {any} */ ({
        serviceProps: createMockCloudService({
          init: vi.fn().mockResolvedValue(false),
          list: vi.fn(),
        }),
      }),
    );

    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('The service is not configured properly.');
  });

  test('uploads files, selecting them and reporting the rejected ones', async () => {
    const upload = vi.fn(async (/** @type {File[]} */ files) =>
      files.map((file) => createMockExternalAsset({ fileName: file.name })),
    );

    const props = $state({
      multiple: true,
      serviceProps: createMockCloudService({ list: vi.fn().mockResolvedValue(assets), upload }),
      selectedResources: /** @type {any[]} */ ([]),
    });

    const { component } = await render(ExternalAssetsPanel, props);

    await waitForList(2);

    const valid = await createMockImageFile({ name: 'c.png' });
    const oversized = new File([new Uint8Array(2000)], 'big.txt', { type: 'text/plain' });

    await component.uploadFiles([valid, oversized]);

    expect(upload).toHaveBeenCalledWith([valid], expect.anything());
    expect(props.selectedResources).toEqual([
      { url: 'https://cdn.example.com/images/c.png', credit: undefined },
    ]);
    // The uploaded file is listed first
    await expect
      .poll(() =>
        page
          .getByRole('option')
          .elements()
          .map((el) => el.dataset.value),
      )
      .toEqual(['images/c.png', 'images/a.png', 'images/b.png']);

    const dialog = page.getByRole('alertdialog', { name: 'Large File' });

    await expect.element(dialog).toBeInTheDocument();
    expect(dialog.element().textContent).toContain('exceeds the maximum size');
  });

  test('uploads a file of any size while the list is still loading', async () => {
    // No size limit is configured
    await initTestConfig();

    const upload = vi.fn(async (/** @type {File[]} */ files) =>
      files.map((file) => createMockExternalAsset({ fileName: file.name })),
    );

    const props = $state({
      serviceProps: createMockCloudService({ list: vi.fn(() => new Promise(() => {})), upload }),
      selectedResources: /** @type {any[]} */ ([]),
    });

    const { component } = await render(ExternalAssetsPanel, props);

    await expect.element(page.getByRole('alert')).toHaveTextContent('Loading…');

    const big = new File([new Uint8Array(2000)], 'big.txt', { type: 'text/plain' });
    const broken = new File(['x'], 'broken.png', { type: 'image/png' });

    await component.uploadFiles([big, broken]);

    expect(upload).toHaveBeenCalledWith([big], expect.anything());
    await waitForList(1);
    // Only the broken file is reported
    await expect.element(page.getByRole('alertdialog', { name: 'Invalid File' })).toBeVisible();
  });

  test('reports an empty result', async () => {
    await render(ExternalAssetsPanel, {
      serviceProps: createMockCloudService({ list: vi.fn().mockResolvedValue(undefined) }),
      selectedResources: [],
    });

    await expect.element(page.getByRole('alert')).toHaveTextContent('No files found.');
  });

  test('reports a file that can’t be decoded, and uploads nothing then', async () => {
    const upload = vi.fn();

    const { component } = await render(
      ExternalAssetsPanel,
      /** @type {any} */ ({
        serviceProps: createMockCloudService({ list: vi.fn().mockResolvedValue([]), upload }),
      }),
    );

    await expect.element(page.getByRole('alert')).toHaveTextContent('No files found.');
    await component.uploadFiles([new File(['x'], 'broken.png', { type: 'image/png' })]);
    expect(upload).not.toHaveBeenCalled();

    const dialog = page.getByRole('alertdialog', { name: 'Invalid File' });

    await expect.element(dialog).toBeVisible();
    expect(dialog.element().textContent).toContain('broken.png');
    await dialog.getByRole('button', { name: 'OK' }).click();
    await expect.poll(() => document.querySelector('[role="alertdialog"]')).toBeNull();
  });

  test('uploads the files dropped onto the list', async () => {
    const upload = vi.fn(async (/** @type {File[]} */ files) =>
      files.map((file) => createMockExternalAsset({ fileName: file.name })),
    );

    await render(
      ExternalAssetsPanel,
      /** @type {any} */ ({
        serviceProps: createMockCloudService({ list: vi.fn().mockResolvedValue([]), upload }),
      }),
    );

    await expect.element(page.getByRole('alert')).toHaveTextContent('No files found.');

    const file = await createMockImageFile({ name: 'dropped.png' });
    const event = new Event('drop', { bubbles: true, cancelable: true });

    Object.defineProperty(event, 'dataTransfer', {
      value: {
        dropEffect: '',
        items: [
          {
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
          },
        ],
      },
    });

    /** @type {HTMLElement} */ (document.querySelector('.drop-target')).dispatchEvent(event);
    await vi.waitFor(() => expect(upload).toHaveBeenCalledWith([file], expect.anything()));
    // The progress toast goes away once the upload is done
    await expect
      .poll(() => document.querySelector('.sui.toast')?.getAttribute('aria-hidden'), {
        timeout: 7000,
      })
      .toBe('true');
  });

  test('can’t upload to a service that doesn’t support it', async () => {
    const { component } = await render(
      ExternalAssetsPanel,
      /** @type {any} */ ({
        serviceProps: createMockCloudService({ list: vi.fn().mockResolvedValue([]) }),
      }),
    );

    await expect.element(page.getByRole('alert')).toHaveTextContent('No files found.');
    await component.uploadFiles([await createMockImageFile()]);
    expect(document.querySelector('.drop-target')).toBeNull();
  });

  test('reports an upload failure', async () => {
    const props = $state({
      serviceProps: createMockCloudService({
        list: vi.fn().mockResolvedValue([]),
        upload: vi.fn().mockRejectedValue(new Error('Boom')),
      }),
      selectedResources: /** @type {any[]} */ ([]),
    });

    const { component } = await render(ExternalAssetsPanel, props);

    await expect.element(page.getByRole('alert')).toHaveTextContent('No files found.');
    await component.uploadFiles([await createMockImageFile({ name: 'c.png' })]);

    await expect
      .poll(() =>
        document.querySelector('.sui.alert.error')?.textContent?.replace(/\s+/g, ' ').trim(),
      )
      .toBe('error Upload failed.');
  });

  test('shows the captions of stock photos in the list view', async () => {
    const asset = createMockExternalAsset({
      fileName: 'photo.jpg',
      asset: { id: '123', description: 'A cat' },
    });

    const { container } = await render(
      ExternalAssetsPanel,
      /** @type {any} */ ({
        serviceProps: createMockCloudService({
          serviceType: 'stock_assets',
          serviceId: 'unsplash',
          list: vi.fn().mockResolvedValue([asset]),
        }),
      }),
    );

    await waitForList(1);
    expect(container.querySelector('[role="listbox"]')).toHaveClass('grid');
    expect(container.querySelector('.name strong')).toBeNull();

    selectAssetsView.current = { type: 'list' };
    await expect.poll(() => container.querySelector('.name strong')?.textContent).toBe('A cat');
  });

  test('forces the grid view for Picsum, which has no descriptions', async () => {
    selectAssetsView.current = { type: 'list' };

    const { container } = await render(
      ExternalAssetsPanel,
      /** @type {any} */ ({
        serviceProps: createMockCloudService({
          serviceType: 'stock_assets',
          serviceId: 'picsum',
          list: vi.fn().mockResolvedValue([createMockExternalAsset({ fileName: 'photo.jpg' })]),
        }),
      }),
    );

    await waitForList(1);
    expect(container.querySelector('[role="listbox"]')).toHaveClass('grid');
  });
});
