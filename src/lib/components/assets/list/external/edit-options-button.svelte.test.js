import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { renamingExternalAsset, selectedCloudService } from '$lib/services/assets/external';
import { uploadingExternalAssets } from '$lib/services/assets/external/data';
import { assetMoveRequest } from '$lib/services/assets/state';
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
};

describe('EditOptionsButton', () => {
  beforeEach(() => {
    renamingExternalAsset.current = undefined;
    assetMoveRequest.current = undefined;
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

  test('offers to move the selected assets on a service that can delete them', async () => {
    const service = createMockCloudService({ rename: vi.fn(), delete: vi.fn() });
    const other = createMockExternalAsset({ fileName: 'other.png' });

    selectedCloudService.current = service;

    await render(EditOptionsButton, { asset, assets: [asset, other] });
    await openMenu();

    expect(
      page
        .getByRole('menuitem')
        .elements()
        .map((el) => el.textContent?.trim()),
    ).toEqual(['Rename', 'Move']);

    await page.getByRole('menuitem', { name: 'Move Asset' }).click();
    expect(assetMoveRequest.current).toEqual({ externalAssets: [asset, other], service });
    expect(assetMoveRequest.current?.service).toBe(service);
  });

  test('moves the selected asset by default', async () => {
    const service = createMockCloudService({ delete: vi.fn() });

    selectedCloudService.current = service;

    await render(EditOptionsButton, { asset });
    await openMenu();
    await page.getByRole('menuitem', { name: 'Move Asset' }).click();
    expect(assetMoveRequest.current).toEqual({ externalAssets: [asset], service });
  });

  test('disables the Move item without an asset', async () => {
    selectedCloudService.current = createMockCloudService({ delete: vi.fn() });

    await render(EditOptionsButton, { asset: undefined });
    await openMenu();

    await expect.element(page.getByRole('menuitem', { name: 'Move Asset' })).toBeDisabled();
  });

  test('offers nothing without a service', async () => {
    selectedCloudService.current = undefined;

    await render(EditOptionsButton, { asset });
    await openMenu();

    expect(page.getByRole('menuitem').elements()).toHaveLength(0);
  });
});
