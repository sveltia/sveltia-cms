import { sleep } from '@sveltia/utils/misc';
import { beforeEach, describe, expect, test, vi } from 'vitest';
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
  beforeEach(() => {
    selectAssetsView.current = { type: 'list' };
  });

  test('lists the assets in the saved view type within a drop zone', async () => {
    const onDrop = vi.fn();
    const props = $state({ assets, selectedResources: [], onDrop });
    const { container } = await render(InternalAssetsPanel, props);
    const listbox = page.getByRole('listbox', { name: 'Available Images' });

    await expect.element(listbox).toHaveAttribute('id', 'select-assets-grid');
    expect(listbox.element()).toHaveClass('list');
    await expect.poll(() => listbox.getByRole('option').elements().length).toBe(2);

    await sleep(150);
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

  test('lists nothing without assets', async () => {
    await render(InternalAssetsPanel, /** @type {any} */ ({}));

    await expect.element(page.getByText('No files found.')).toBeVisible();
  });
});
