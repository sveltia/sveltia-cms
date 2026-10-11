import { addMessages, locale } from '@sveltia/i18n';
import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { selectAssetsView } from '$lib/services/contents/editor';
import { createMockAsset } from '$lib/test/config';

import InternalAssetsPanel from './internal-assets-panel.svelte';

const assets = [createMockAsset({ name: 'photo.png' }), createMockAsset({ name: 'logo.png' })];

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

describe('InternalAssetsPanel', () => {
  // Register a right-to-left locale, without strings, so it can be switched to
  beforeAll(() => {
    addMessages('ar', {});
  });

  beforeEach(() => {
    selectAssetsView.current = { type: 'list' };
  });

  test('shows a breadcrumb while a subfolder is browsed, leading back up', async () => {
    const onNavigate = vi.fn();
    const onOpenSubfolder = vi.fn();
    const subfolders = [{ name: 'august', path: 'static/uploads/2024/summer/august' }];

    await render(InternalAssetsPanel, {
      assets,
      basePath: 'static/uploads/2024/summer',
      folderLabel: 'Global Assets',
      subfolderPath: '2024/summer',
      subfolders,
      selectedResources: [],
      onDrop: vi.fn(),
      onNavigate,
      onOpenSubfolder,
    });

    const breadcrumb = page.getByRole('navigation', { name: 'Folder' });

    await expect
      .element(breadcrumb)
      .toMatchTextContent('Global Assets chevron_right 2024 chevron_right summer');

    await breadcrumb.getByRole('button', { name: '2024' }).click();
    expect(onNavigate).toHaveBeenCalledWith('2024');
    await breadcrumb.getByRole('button', { name: 'Global Assets' }).click();
    expect(onNavigate).toHaveBeenCalledWith('');

    await page
      .getByRole('listbox', { name: 'Folders' })
      .getByRole('option', { name: 'august' })
      .click();
    expect(onOpenSubfolder).toHaveBeenCalledWith(subfolders[0]);
  });

  test('points the breadcrumb separators the other way in a right-to-left locale', async () => {
    locale.set('ar');

    try {
      await render(InternalAssetsPanel, {
        assets,
        folderLabel: 'Global Assets',
        subfolderPath: '2024',
        selectedResources: [],
        onDrop: vi.fn(),
      });

      await expect
        .element(page.getByRole('navigation', { name: 'Folder' }))
        .toMatchTextContent('Global Assets chevron_left 2024');
    } finally {
      locale.set('en-US');
    }
  });

  test('has no breadcrumb at the folder root', async () => {
    await render(InternalAssetsPanel, { assets, selectedResources: [], onDrop: vi.fn() });

    await expect.poll(() => page.getByRole('option').elements().length).toBe(2);
    expect(page.getByRole('navigation').elements()).toHaveLength(0);
  });

  test('lists the assets in the saved view type within a drop zone', async () => {
    const onDrop = vi.fn();

    const props = $state({
      assets,
      kind: /** @type {'image'} */ ('image'),
      selectedResources: [],
      onDrop,
    });

    const { container } = await render(InternalAssetsPanel, props);
    const listbox = page.getByRole('listbox', { name: 'Available Images' });

    await expect.element(listbox).toHaveAttribute('id', 'select-assets-grid');
    expect(listbox.element()).toHaveClass('list');
    await expect.poll(() => listbox.getByRole('option').elements().length).toBe(2);

    await page
      .elementLocator(
        /** @type {HTMLElement} */ (
          container.querySelector(`[role="option"][data-value="${assets[1].path}"]`)
        ),
      )
      .click();
    await expect
      .poll(() => props.selectedResources)
      .toEqual([{ asset: expect.objectContaining({ path: assets[1].path }) }]);

    const file = new File(['x'], 'new.png', { type: 'image/png' });

    /** @type {HTMLElement} */ (container.querySelector('.drop-target')).dispatchEvent(
      createDropEvent([file]),
    );

    await vi.waitFor(() => expect(onDrop).toHaveBeenCalledWith({ files: [file] }));
  });

  test('passes on a dropped file of another type, to be checked once processed', async () => {
    const onDrop = vi.fn();

    const { container } = await render(InternalAssetsPanel, {
      assets,
      accept: 'image/webp',
      selectedResources: [],
      onDrop,
    });

    const file = new File(['x'], 'kite.png', { type: 'image/png' });

    /** @type {HTMLElement} */ (container.querySelector('.drop-target')).dispatchEvent(
      createDropEvent([file]),
    );

    await vi.waitFor(() => expect(onDrop).toHaveBeenCalledWith({ files: [file] }));
    expect(page.getByRole('alertdialog').elements()).toHaveLength(0);
  });

  test('takes no dropped files where nothing can be uploaded', async () => {
    const onDrop = vi.fn();

    const { container } = await render(InternalAssetsPanel, {
      assets,
      uploadDisabled: true,
      selectedResources: [],
      onDrop,
    });

    const target = /** @type {HTMLElement} */ (container.querySelector('.drop-target'));

    // Dragging files over the panel doesn’t invite a drop
    target.dispatchEvent(
      new DragEvent('dragover', {
        bubbles: true,
        cancelable: true,
        dataTransfer: new DataTransfer(),
      }),
    );
    target.dispatchEvent(createDropEvent([new File(['x'], 'kite.png', { type: 'image/png' })]));
    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
    expect(container.querySelector('.drop-indicator')).toBeNull();
    expect(onDrop).not.toHaveBeenCalled();
  });

  test('lists nothing without assets', async () => {
    await render(InternalAssetsPanel, /** @type {any} */ ({}));

    await expect.element(page.getByText('No files found.')).toBeVisible();
  });
});
