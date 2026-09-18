import { sleep } from '@sveltia/utils/misc';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { globalAssetFolder } from '$lib/services/assets/folders';
import { allCloudStorageServices } from '$lib/services/integrations/media-libraries/cloud';
import { env } from '$lib/services/user/env.svelte';
import {
  createMockAsset,
  createMockCloudService,
  createMockExternalAsset,
  createMockImageFile,
  initTestConfig,
  setAssets,
} from '$lib/test/config';
import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import FileEditor from './file-editor.svelte';

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

/**
 * Render the editor within a draft.
 * @param {Record<string, any>} config Field options.
 * @param {any} currentValue Field value.
 * @param {Record<string, any>} [values] Flattened values.
 * @param {Record<string, any>} [props] Props to override.
 * @param {Record<string, any>} [context] Field editor context.
 * @returns {Promise<{ draft: any, props: any, container: HTMLElement }>} Draft, props and
 * container.
 */
const renderEditor = async (config, currentValue, values = {}, props = {}, context = undefined) => {
  const fieldConfig = { name: 'image', widget: 'image', ...config };
  const draft = createMockDraft({ fields: [fieldConfig], values: { _default: values } });

  const _props = $state({
    locale: '_default',
    keyPath: 'image',
    typedKeyPath: 'image',
    fieldId: 'image',
    fieldConfig,
    currentValue,
    required: false,
    ...props,
  });

  const { container } = await renderWithDraft(FileEditor, {
    draft,
    props: _props,
    context: context ? { 'field-editor': context } : {},
  });

  return { draft, props: _props, container };
};

describe('FileEditor', () => {
  beforeEach(async () => {
    await initTestConfig({
      site_url: 'https://example.com',
      collections: [
        {
          name: 'posts',
          label: 'Posts',
          folder: 'content/posts',
          fields: [
            { name: 'image', widget: 'image' },
            { name: 'images', widget: 'image', multiple: true },
          ],
        },
      ],
    });
    setAssets([
      createMockAsset({
        name: 'photo.png',
        file: await createMockImageFile(),
        asset: { folder: globalAssetFolder.current },
      }),
    ]);
    env.hasMouse = true;
  });

  test('offers to upload a file, and takes a dropped one', async () => {
    const { draft, props, container } = await renderEditor({}, '');

    await expect.element(page.getByText(/Drop an image file here/)).toBeInTheDocument();

    const file = await createMockImageFile({ name: 'new.png' });

    /** @type {HTMLElement} */ (container.querySelector('.drop-target')).dispatchEvent(
      createDropEvent([file]),
    );

    // The file is held in the draft under a temporary URL until the entry is saved
    await expect.poll(() => props.currentValue).toMatch(/^blob:/);
    expect(draft.files[props.currentValue]).toEqual({
      file,
      folder: globalAssetFolder.current,
      replace: false,
    });
    await expect.element(page.getByRole('textbox')).toHaveTextContent('/static/uploads/new.png');
  });

  test('shows the selected file and lets it be removed', async () => {
    const { props } = await renderEditor({}, '/static/uploads/photo.png');

    await expect.element(page.getByRole('textbox')).toHaveTextContent('/static/uploads/photo.png');

    await page.getByRole('button', { name: 'Remove Image' }).click();
    expect(props.currentValue).toBe('');
    await expect.element(page.getByText(/Drop an image file here/)).toBeInTheDocument();
  });

  test('doesn’t offer to remove a required file', async () => {
    await renderEditor({}, '/static/uploads/photo.png', {}, { required: true });

    await expect.element(page.getByRole('textbox')).toHaveTextContent('/static/uploads/photo.png');
    await expect.element(page.getByRole('button', { name: 'Replace Image' })).toBeVisible();
    expect(page.getByRole('button', { name: 'Remove Image' }).elements()).toHaveLength(0);
  });

  test('shows nothing for a value that isn’t a path', async () => {
    const { container } = await renderEditor({}, ['/static/uploads/photo.png']);

    await expect.poll(() => container.querySelector('.drop-target')).not.toBeNull();
    expect(page.getByRole('textbox').elements()).toHaveLength(0);
    expect(page.getByRole('button').elements()).toHaveLength(0);
  });

  test('opens the asset dialog to select or replace a file', async () => {
    const { props } = await renderEditor({}, '');

    await page.getByRole('button', { name: 'Browse' }).click();

    const dialog = page.getByRole('dialog', { name: 'Select Image' });

    await expect.element(dialog).toBeInTheDocument();
    await expect
      .poll(() => document.querySelectorAll('#select-assets-grid [role="option"]').length)
      .toBe(1);
    await sleep(150);
    await page
      .elementLocator(
        /** @type {HTMLElement} */ (document.querySelector('#select-assets-grid [role="option"]')),
      )
      .click();
    await dialog.getByRole('button', { name: 'Insert' }).click();

    await expect.poll(() => props.currentValue).toBe('/static/uploads/photo.png');

    // Replacing opens the dialog again
    await expect.poll(() => page.getByRole('dialog').elements().length).toBe(0);
    await page.getByRole('button', { name: 'Replace Image' }).click();
    await expect.element(page.getByRole('dialog', { name: 'Select Image' })).toBeInTheDocument();
  });

  test('lists multiple files, adding, reordering and removing them', async () => {
    const { draft, props, container } = await renderEditor(
      { name: 'images', multiple: true },
      ['/static/uploads/a.png', '/static/uploads/b.png'],
      { 'images.0': '/static/uploads/a.png', 'images.1': '/static/uploads/b.png' },
      { keyPath: 'images', typedKeyPath: 'images', fieldId: 'images' },
    );

    /**
     * Get the listed file paths.
     * @returns {(string | undefined)[]} Paths.
     */
    const getPaths = () =>
      page
        .getByRole('textbox')
        .elements()
        .map((el) => el.textContent?.trim());

    await expect.poll(getPaths).toEqual(['/static/uploads/a.png', '/static/uploads/b.png']);
    await expect.element(page.getByText(/Drop image files here/)).toBeInTheDocument();

    // Add another file
    const file = await createMockImageFile({ name: 'c.png' });

    /** @type {HTMLElement} */ (container.querySelector('.drop-target')).dispatchEvent(
      createDropEvent([file]),
    );
    await expect.poll(() => draft.currentValues._default['images.2']).toMatch(/^blob:/);

    /**
     * Reflect the draft in the value, the way the field editor does.
     * @returns {void}
     */
    const syncValue = () => {
      props.currentValue = [0, 1, 2]
        .map((i) => draft.currentValues._default[`images.${i}`])
        .filter((v) => v !== undefined);
    };

    syncValue();
    await expect.poll(() => getPaths().length).toBe(3);

    // Move the last one to the top
    page.getByRole('button', { name: 'Reorder Item' }).nth(2).element().focus();
    await userEvent.keyboard('{Home}');
    await expect.poll(() => draft.currentValues._default['images.0']).toMatch(/^blob:/);
    expect(draft.currentValues._default['images.1']).toBe('/static/uploads/a.png');

    // Remove the first one
    syncValue();
    await expect.poll(() => getPaths()[0]).toBe('/static/uploads/new-c.png'.replace('new-', ''));
    await page.getByRole('button', { name: 'Remove Image' }).nth(0).click();
    await expect.poll(() => draft.currentValues._default['images.0']).toBe('/static/uploads/a.png');
    expect(draft.currentValues._default['images.2']).toBeUndefined();
  });

  test('takes any kind of file for a file field', async () => {
    const { draft, props, container } = await renderEditor(
      { name: 'file', widget: 'file' },
      '',
      {},
      { keyPath: 'file', typedKeyPath: 'file', fieldId: 'file' },
    );

    await expect.element(page.getByText(/Drop a file here/)).toBeInTheDocument();

    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' });

    /** @type {HTMLElement} */ (container.querySelector('.drop-target')).dispatchEvent(
      createDropEvent([file]),
    );

    await expect.poll(() => props.currentValue).toMatch(/^blob:/);
    expect(draft.files[props.currentValue].file).toBe(file);
  });

  test('starts a list of files from nothing', async () => {
    const { draft, props, container } = await renderEditor(
      { name: 'images', multiple: true },
      undefined,
      {},
      { keyPath: 'images', typedKeyPath: 'images', fieldId: 'images' },
    );

    await expect.element(page.getByText(/Drop image files here/)).toBeInTheDocument();

    const file = await createMockImageFile({ name: 'new.png' });

    /** @type {HTMLElement} */ (container.querySelector('.drop-target')).dispatchEvent(
      createDropEvent([file]),
    );

    await expect.poll(() => draft.currentValues._default['images.0']).toMatch(/^blob:/);
    expect(props.currentValue).toBeUndefined();
  });

  test('encodes spaces in the path within the rich text editor', async () => {
    setAssets([
      createMockAsset({
        name: 'my photo.png',
        file: await createMockImageFile(),
        asset: { folder: globalAssetFolder.current },
      }),
    ]);

    const { props } = await renderEditor(
      {},
      '/static/uploads/my photo.png',
      {},
      {},
      {
        fieldContext: 'rich-text-editor-component',
      },
    );

    // The component has its own way to remove the image
    await expect
      .element(page.getByRole('textbox'))
      .toHaveTextContent('/static/uploads/my photo.png');
    expect(page.getByRole('button', { name: 'Remove Image' }).elements()).toHaveLength(0);

    await page.getByRole('button', { name: 'Replace Image' }).click();

    const dialog = page.getByRole('dialog', { name: 'Select Image' });

    await expect
      .poll(() => document.querySelectorAll('#select-assets-grid [role="option"]').length)
      .toBe(1);
    await sleep(150);
    await page
      .elementLocator(
        /** @type {HTMLElement} */ (document.querySelector('#select-assets-grid [role="option"]')),
      )
      .click();
    await dialog.getByRole('button', { name: 'Insert' }).click();

    await expect.poll(() => props.currentValue).toBe('/static/uploads/my%20photo.png');
  });

  test('stops offering uploads at the limit', async () => {
    await renderEditor(
      { name: 'images', multiple: true, max: 1 },
      ['/static/uploads/a.png'],
      { 'images.0': '/static/uploads/a.png' },
      { keyPath: 'images', typedKeyPath: 'images', fieldId: 'images' },
    );

    await expect.element(page.getByRole('textbox')).toHaveTextContent('/static/uploads/a.png');
    expect(page.getByText(/Drop/).elements()).toHaveLength(0);
  });

  test('reports a file that can’t be used', async () => {
    const { props, container } = await renderEditor({}, '');

    /** @type {HTMLElement} */ (container.querySelector('.drop-target')).dispatchEvent(
      createDropEvent([new File(['x'], 'broken.png', { type: 'image/png' })]),
    );

    const dialog = page.getByRole('alertdialog');

    await expect.element(dialog).toBeInTheDocument();
    expect(dialog.element().textContent).toContain('broken.png');
    expect(props.currentValue).toBe('');
  });

  test('is read-only', async () => {
    await renderEditor({}, '/static/uploads/photo.png', {}, { readonly: true });

    await expect.element(page.getByRole('button', { name: 'Replace Image' })).toBeDisabled();
    await expect.element(page.getByRole('button', { name: 'Remove Image' })).toBeDisabled();
  });

  describe('with a cloud storage service', () => {
    /** @type {any} */
    const services = allCloudStorageServices;
    /** @type {string} */
    let imageURL;

    beforeEach(async () => {
      imageURL = URL.createObjectURL(await createMockImageFile());

      // Register a service that needs no network access
      services.test_cloud = createMockCloudService({
        hotlinking: false,
        list: vi.fn().mockResolvedValue([
          createMockExternalAsset({
            fileName: 'cloud.png',
            asset: { downloadURL: imageURL, previewURL: imageURL, credit: 'Photo by Melvin' },
          }),
        ]),
        upload: vi.fn(),
      });
    });

    afterEach(() => {
      delete services.test_cloud;
    });

    test('downloads a selected file, showing the credit', async () => {
      // Two providers, so nothing can be dropped
      const { props } = await renderEditor({}, '');

      expect(document.querySelector('.drop-target')).toBeNull();

      await page.getByRole('button', { name: 'Browse' }).click();

      const dialog = page.getByRole('dialog', { name: 'Select Image' });

      await sleep(150);
      await dialog.getByRole('option', { name: 'Test Cloud' }).click();
      await expect
        .poll(() => document.querySelectorAll('#select-assets-grid [role="option"]').length)
        .toBe(1);
      await sleep(150);
      await page
        .elementLocator(
          /** @type {HTMLElement} */ (
            document.querySelector('#select-assets-grid [role="option"]')
          ),
        )
        .click();
      await dialog.getByRole('button', { name: 'Insert' }).click();

      // The downloaded file goes into the default folder
      await expect.poll(() => props.currentValue).toMatch(/^blob:/);

      const credit = page.getByRole('alertdialog', { name: 'Photo Credit' });

      await expect.element(credit.getByRole('textbox')).toHaveValue('Photo by Melvin');
      // The text is selected on click, ready to be copied
      credit
        .getByRole('textbox')
        .element()
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await expect.element(credit.getByRole('textbox')).toHaveFocus();

      const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();

      await credit.getByRole('button', { name: 'Copy' }).click();
      // The handler runs once the dialog is closed
      await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith('Photo by Melvin'));
    });

    test('hands dropped files to the service when the default library is off', async () => {
      const file = await createMockImageFile({ name: 'up.png' });

      const { container } = await renderEditor(
        { media_libraries: { default: false, stock_assets: false } },
        '',
      );

      /** @type {HTMLElement} */ (container.querySelector('.drop-target')).dispatchEvent(
        createDropEvent([file]),
      );

      // The dialog opens on the service to upload the files there
      await expect.element(page.getByRole('dialog', { name: 'Select Image' })).toBeInTheDocument();
      await vi.waitFor(() =>
        expect(services.test_cloud.upload).toHaveBeenCalledWith([file], expect.anything()),
      );
    });
  });

  test('accepts HEIC photos only when they are converted on upload', async () => {
    /**
     * Get the `accept` attribute of the file input in the given container.
     * @param {HTMLElement} container Container.
     * @returns {string} Accepted types.
     */
    const getAccept = (container) =>
      /** @type {HTMLInputElement} */ (container.querySelector('input[type="file"]')).accept;

    const { container } = await renderEditor({}, '');

    // Listing the HEIC types would make iOS Safari hand over raw HEIC photos, which nothing else
    // could display
    expect(getAccept(container)).toContain('image/png');
    expect(getAccept(container)).not.toContain('image/heic');

    await initTestConfig({
      media_libraries: { default: { config: { transformations: { raster_image: {} } } } },
      collections: [
        {
          name: 'posts',
          label: 'Posts',
          folder: 'content/posts',
          fields: [{ name: 'image', widget: 'image' }],
        },
      ],
    });

    const { container: convertingContainer } = await renderEditor({}, '');

    expect(getAccept(convertingContainer)).toContain('image/heic');
  });

  test('reports a file that is too large', async () => {
    await initTestConfig({
      media_libraries: { all: { max_file_size: 10 } },
      collections: [
        {
          name: 'posts',
          label: 'Posts',
          folder: 'content/posts',
          fields: [{ name: 'image', widget: 'image' }],
        },
      ],
    });

    const { container } = await renderEditor({}, '');

    /** @type {HTMLElement} */ (container.querySelector('.drop-target')).dispatchEvent(
      createDropEvent([await createMockImageFile({ name: 'big.png' })]),
    );

    const dialog = page.getByRole('alertdialog', { name: 'Large File' });

    await expect.element(dialog).toBeInTheDocument();
    expect(dialog.element().textContent).toContain('big.png');
    await dialog.getByRole('button', { name: 'OK' }).click();
    await expect.poll(() => page.getByRole('alertdialog').elements().length).toBe(0);
  });

  test('asks what to do with a file that has the name of an existing asset', async () => {
    const { props, container } = await renderEditor({}, '');

    /** @type {HTMLElement} */ (container.querySelector('.drop-target')).dispatchEvent(
      createDropEvent([await createMockImageFile({ name: 'photo.png' })]),
    );

    const dialog = page.getByRole('alertdialog');

    await expect.element(dialog).toBeInTheDocument();
    // Cancelling leaves the field alone
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect.poll(() => page.getByRole('alertdialog').elements().length).toBe(0);
    expect(props.currentValue).toBe('');
  });

  test('takes a pasted image', async () => {
    const { props } = await renderEditor({}, '');
    const blob = await createMockImageFile();

    vi.spyOn(navigator.clipboard, 'read').mockResolvedValue([
      /** @type {any} */ ({ types: ['image/png'], getType: vi.fn().mockResolvedValue(blob) }),
    ]);

    await page.getByRole('button', { name: 'Paste Image' }).click();
    await expect.poll(() => props.currentValue).toMatch(/^blob:/);
  });

  test('replaces one of multiple files, and reorders them by dragging', async () => {
    const { draft, props, container } = await renderEditor(
      { name: 'images', multiple: true },
      ['/static/uploads/a.png', '/static/uploads/b.png'],
      { 'images.0': '/static/uploads/a.png', 'images.1': '/static/uploads/b.png' },
      { keyPath: 'images', typedKeyPath: 'images', fieldId: 'images' },
    );

    await page.getByRole('button', { name: 'Replace Image' }).nth(1).click();

    const dialog = page.getByRole('dialog', { name: 'Select Image' });

    await expect
      .poll(() => document.querySelectorAll('#select-assets-grid [role="option"]').length)
      .toBe(1);
    await sleep(150);
    await page
      .elementLocator(
        /** @type {HTMLElement} */ (document.querySelector('#select-assets-grid [role="option"]')),
      )
      .click();
    await dialog.getByRole('button', { name: 'Insert' }).click();

    await expect
      .poll(() => draft.currentValues._default['images.1'])
      .toBe('/static/uploads/photo.png');
    expect(draft.currentValues._default['images.0']).toBe('/static/uploads/a.png');

    // Reflect the draft in the value, the way the field editor does, then drag the first item
    // below the second
    props.currentValue = ['/static/uploads/a.png', '/static/uploads/photo.png'];
    await expect.poll(() => container.querySelectorAll('.item-list > div').length).toBe(2);

    const [first, second] = container.querySelectorAll('.item-list > div');
    const item = /** @type {HTMLElement} */ (first.querySelector('.filled'));
    const dataTransfer = new DataTransfer();

    item.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer }));

    const { bottom } = second.getBoundingClientRect();

    second.dispatchEvent(
      new DragEvent('dragover', {
        bubbles: true,
        cancelable: true,
        dataTransfer,
        clientY: bottom - 1,
      }),
    );
    // The move is previewed, animated, before it’s committed
    await expect
      .poll(() => container.querySelector('.item-list > div .filename')?.textContent?.trim())
      .toBe('/static/uploads/photo.png');
    second.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }));
    item.dispatchEvent(new DragEvent('dragend', { bubbles: true }));

    await expect
      .poll(() => draft.currentValues._default['images.0'])
      .toBe('/static/uploads/photo.png');
  });
});
