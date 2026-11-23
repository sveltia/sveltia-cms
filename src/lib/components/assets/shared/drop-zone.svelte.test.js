import { createRawSnippet } from 'svelte';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { ASSET_DRAG_TYPE } from '$lib/services/assets/drag';
import { env } from '$lib/services/user/env.svelte';
import { SUPPORTED_IMAGE_TYPES } from '$lib/services/utils/media/image';
import { createFileDropEvent } from '$lib/test/drop';

import DropZone from './drop-zone.svelte';

const image = new File(['x'], 'photo.png', { type: 'image/png' });
const doc = new File(['x'], 'notes.txt', { type: 'text/plain' });

/**
 * Get the drop target.
 * @param {HTMLElement} container Container.
 * @returns {HTMLElement} Element.
 */
const getTarget = (container) =>
  /** @type {HTMLElement} */ (container.querySelector('.drop-target'));

describe('DropZone', () => {
  beforeEach(() => {
    env.hasMouse = true;
  });

  test('reports the dropped files', async () => {
    const onDrop = vi.fn();

    const { container } = await render(DropZone, {
      multiple: true,
      showUploadButton: true,
      onDrop,
    });

    await expect.element(page.getByText('Drop files here or click to browse…')).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Choose Files' })).toBeVisible();

    const target = getTarget(container);

    target.dispatchEvent(new Event('dragover', { cancelable: true }));
    // The drop indicator only appears when the event carries data
    expect(container.querySelector('.drop-indicator')).toBeNull();

    target.dispatchEvent(createFileDropEvent([image, doc]));
    // The files are sorted by name
    await vi.waitFor(() =>
      expect(onDrop.mock.calls[0]?.[0].files.map((/** @type {File} */ f) => f.name)).toEqual([
        'notes.txt',
        'photo.png',
      ]),
    );
  });

  test('keeps a single file, and shows a preview of it', async () => {
    const onDrop = vi.fn();
    const { container } = await render(DropZone, { showFilePreview: true, onDrop });

    getTarget(container).dispatchEvent(createFileDropEvent([image, doc]));

    await vi.waitFor(() =>
      expect(onDrop.mock.calls[0]?.[0].files.map((/** @type {File} */ f) => f.name)).toEqual([
        'notes.txt',
      ]),
    );
    await expect
      .element(page.getByRole('listitem'))
      .toHaveTextContent('draft notes.txt TXT · \u20681\u2069 bytes close');
  });

  test('rejects a file of another type', async () => {
    const onDrop = vi.fn();

    const { container } = await render(DropZone, {
      accept: 'image/png, image/jpeg',
      showUploadButton: true,
      onDrop,
    });

    getTarget(container).dispatchEvent(createFileDropEvent([doc]));

    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent(
        'The dropped file is not one of the following types: \u2068image/png or image/jpeg\u2069. Please try again.',
      );
    expect(onDrop).not.toHaveBeenCalled();
  });

  test('warns in a dialog when it has custom content', async () => {
    const { container } = await render(DropZone, {
      accept: 'image/png',
      children: createRawSnippet(() => ({
        /**
         * Render the content.
         * @returns {string} HTML.
         */
        render: () => '<p>Custom</p>',
      })),
    });

    expect(container).toHaveTextContent('Custom');
    getTarget(container).dispatchEvent(createFileDropEvent([doc]));

    const dialog = page.getByRole('alertdialog', { name: 'Unsupported File Type' });

    await expect.element(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'OK' }).click();
    await expect.poll(() => document.querySelector('[role="alertdialog"]')).toBeNull();
  });

  test('leaves the type check to the consumer when asked', async () => {
    const onDrop = vi.fn();

    const { container } = await render(DropZone, {
      accept: 'image/png',
      filterDroppedFiles: false,
      onDrop,
    });

    getTarget(container).dispatchEvent(createFileDropEvent([doc]));
    await vi.waitFor(() => expect(onDrop).toHaveBeenCalledWith({ files: [doc] }));

    // An empty drop is silently ignored
    getTarget(container).dispatchEvent(createFileDropEvent([]));
    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  });

  test('ignores a drop without files, like text or a link', async () => {
    const onDrop = vi.fn();
    // The Asset Library accepts any file type
    const { container } = await render(DropZone, { multiple: true, onDrop });
    const dataTransfer = new DataTransfer();

    dataTransfer.setData('text/plain', 'https://example.com/');
    getTarget(container).dispatchEvent(
      new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }),
    );
    // An empty folder holds no files either
    getTarget(container).dispatchEvent(createFileDropEvent([]));

    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    expect(onDrop).not.toHaveBeenCalled();
  });

  test('ignores text dropped on a zone accepting certain types only', async () => {
    const { container } = await render(DropZone, { accept: 'image/png', showUploadButton: true });
    const dataTransfer = new DataTransfer();

    dataTransfer.setData('text/plain', 'hello');
    getTarget(container).dispatchEvent(
      new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }),
    );

    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
    expect(page.getByRole('alert').elements()).toHaveLength(0);
  });

  test('shows the drop indicator while dragging over the zone', async () => {
    const { container } = await render(DropZone, { multiple: true, showUploadButton: true });
    const target = getTarget(container);

    /**
     * Dispatch a drag event carrying data.
     * @param {string} type Event type.
     */
    const dispatch = (type) => {
      target.dispatchEvent(
        new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() }),
      );
    };

    dispatch('dragover');
    await expect.element(page.getByText('Drop files here')).toBeVisible();

    dispatch('dragleave');
    await expect.poll(() => container.querySelector('.drop-indicator')).toBeNull();

    dispatch('dragover');
    await expect.element(page.getByText('Drop files here')).toBeVisible();

    dispatch('dragend');
    await expect.poll(() => container.querySelector('.drop-indicator')).toBeNull();
  });

  test('leaves the assets dragged from the list alone, as they’re moved rather than uploaded', async () => {
    const onDrop = vi.fn();

    const { container } = await render(DropZone, {
      multiple: true,
      showUploadButton: true,
      onDrop,
    });

    const target = getTarget(container);

    /**
     * Dispatch a drag event carrying assets.
     * @param {string} type Event type.
     * @returns {DragEvent} Event.
     */
    const dispatch = (type) => {
      const dataTransfer = new DataTransfer();

      dataTransfer.setData(ASSET_DRAG_TYPE, '["static/uploads/a.png"]');

      const event = new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer });

      target.dispatchEvent(event);

      return event;
    };

    // The drop isn’t accepted, so the browser shows that it can’t be dropped here
    expect(dispatch('dragover').defaultPrevented).toBe(false);
    expect(dispatch('drop').defaultPrevented).toBe(false);

    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
    expect(container.querySelector('.drop-indicator')).toBeNull();
    expect(onDrop).not.toHaveBeenCalled();
  });

  test('asks for a single file when only one is accepted', async () => {
    const { container } = await render(DropZone, { showUploadButton: true });

    getTarget(container).dispatchEvent(
      new DragEvent('dragover', {
        bubbles: true,
        cancelable: true,
        dataTransfer: new DataTransfer(),
      }),
    );
    await expect.element(page.getByText('Drop a file here')).toBeVisible();
  });

  test('keeps the indicator hidden while disabled', async () => {
    const { container } = await render(DropZone, { disabled: true, showUploadButton: true });
    const target = getTarget(container);

    ['dragover', 'dragleave', 'dragend'].forEach((type) => {
      target.dispatchEvent(
        new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() }),
      );
    });

    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
    expect(container.querySelector('.drop-indicator')).toBeNull();
  });

  test('suggests tapping on a touch device', async () => {
    env.hasMouse = false;

    await render(DropZone, { showUploadButton: true });
    await expect.element(page.getByText('Tap to browse…')).toBeVisible();
  });

  test('lists the supported image formats when only images are accepted', async () => {
    const { container } = await render(DropZone, {
      accept: SUPPORTED_IMAGE_TYPES.join(','),
      showUploadButton: true,
    });

    getTarget(container).dispatchEvent(createFileDropEvent([doc]));

    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent(
        'The dropped file is not supported. Only an image of the following types is accepted: ' +
          '\u2068AVIF, GIF, JPEG, PNG, WebP, or SVG\u2069. Please try again.',
      );
  });

  test('passes the files dropped by a wrapper through', async () => {
    const onDrop = vi.fn();
    const { container } = await render(DropZone, { onDrop });

    getTarget(container).dispatchEvent(new CustomEvent('Select', { detail: { files: [image] } }));
    expect(onDrop).toHaveBeenCalledWith({ files: [image] });
  });

  test('opens the file picker, reports the chosen files and resets the list', async () => {
    const onDrop = vi.fn();

    const { component, container } = await render(DropZone, {
      showFilePreview: true,
      showUploadButton: true,
      onDrop,
    });

    const input = /** @type {HTMLInputElement} */ (container.querySelector('input[type="file"]'));
    const click = vi.spyOn(input, 'click').mockImplementation(() => {});

    component.openFilePicker();
    expect(click).toHaveBeenCalled();

    await page.getByRole('button', { name: 'Choose File' }).click();
    expect(click).toHaveBeenCalledTimes(2);

    // Nothing to reset yet
    component.reset();
    expect(onDrop).not.toHaveBeenCalled();

    // Choose a file with the picker
    const dataTransfer = new DataTransfer();

    dataTransfer.items.add(image);
    input.files = dataTransfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));

    expect(onDrop).toHaveBeenLastCalledWith({ files: [image] });
    await expect.element(page.getByRole('listitem')).toBeVisible();

    component.reset();
    expect(onDrop).toHaveBeenLastCalledWith({ files: [] });
    await expect.poll(() => page.getByRole('listitem').elements().length).toBe(0);
  });

  test('ignores drops while disabled', async () => {
    const onDrop = vi.fn();
    const { container } = await render(DropZone, { disabled: true, onDrop });

    getTarget(container).dispatchEvent(createFileDropEvent([image]));
    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
    expect(onDrop).not.toHaveBeenCalled();
  });
});
