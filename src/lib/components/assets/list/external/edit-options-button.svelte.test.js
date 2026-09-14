import { sleep } from '@sveltia/utils/misc';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { renamingExternalAsset, selectedCloudService } from '$lib/services/assets/external';
import { uploadingExternalAssets } from '$lib/services/assets/external/data';
import { createMockCloudService, createMockExternalAsset } from '$lib/test/config';

import EditOptionsButton from './edit-options-button.svelte';

const asset = createMockExternalAsset({ fileName: 'photo.png' });

/**
 * Open the menu.
 * @returns {Promise<void>}
 */
const openMenu = async () => {
  // Wait for the previous popup to be unmounted
  await expect.poll(() => document.querySelector('dialog.popup')).toBeNull();
  await page.getByRole('button', { name: 'Show Edit Options' }).click();
  // A Sveltia UI menu starts handling clicks 100 ms after it’s opened
  await sleep(150);
};

describe('EditOptionsButton', () => {
  beforeEach(() => {
    renamingExternalAsset.current = undefined;
  });

  test('offers to rename and replace the asset', async () => {
    selectedCloudService.current = createMockCloudService({ rename: vi.fn(), replace: vi.fn() });

    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});

    try {
      await render(EditOptionsButton, { asset });
      await openMenu();

      expect(
        page
          .getByRole('menuitem')
          .elements()
          .map((el) => el.textContent?.trim()),
      ).toEqual(['Rename', 'Replace']);

      await page.getByRole('menuitem', { name: 'Rename Asset' }).click();
      expect(renamingExternalAsset.current).toBe(asset);

      await openMenu();
      await page.getByRole('menuitem', { name: 'Replace Asset' }).click();
      // The file picker is opened to choose the replacement
      expect(click).toHaveBeenCalledOnce();

      const input = /** @type {HTMLInputElement} */ (click.mock.instances[0]);
      const file = new File(['x'], 'new.png', { type: 'image/png' });
      const dataTransfer = new DataTransfer();

      dataTransfer.items.add(file);
      input.files = dataTransfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      expect(uploadingExternalAssets.current).toEqual({ files: [file], originalAsset: asset });
    } finally {
      click.mockRestore();
    }
  });

  test('omits the operations the service doesn’t support', async () => {
    selectedCloudService.current = createMockCloudService({ rename: vi.fn() });

    await render(EditOptionsButton, { asset });
    await openMenu();

    expect(
      page
        .getByRole('menuitem')
        .elements()
        .map((el) => el.textContent?.trim()),
    ).toEqual(['Rename']);
  });

  test('disables the items without an asset', async () => {
    selectedCloudService.current = createMockCloudService({ rename: vi.fn(), replace: vi.fn() });

    await render(EditOptionsButton, { asset: undefined });
    await openMenu();

    await expect.element(page.getByRole('menuitem', { name: 'Rename Asset' })).toBeDisabled();
    await expect.element(page.getByRole('menuitem', { name: 'Replace Asset' })).toBeDisabled();
  });
});
