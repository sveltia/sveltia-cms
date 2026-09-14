import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import {
  externalAssets,
  overlaidExternalAssetId,
  renamingExternalAsset,
  selectedCloudService,
} from '$lib/services/assets/external';
import { showAssetOverlay } from '$lib/services/assets/view';
import { createMockCloudService, createMockExternalAsset } from '$lib/test/config';
import { waitForRenameDialog } from '$lib/test/dialog';

import RenameDialog from './rename-dialog.svelte';

const assets = [
  createMockExternalAsset({ fileName: 'a.png' }),
  createMockExternalAsset({ fileName: 'b.png' }),
  createMockExternalAsset({ fileName: 'c.png', folder: 'other' }),
];

const [firstAsset] = assets;

describe('RenameDialog', () => {
  /** @type {import('vitest').Mock} */
  let rename;

  beforeEach(() => {
    rename = vi.fn(async (asset, newName) =>
      createMockExternalAsset({ fileName: newName, asset: { kind: asset.kind } }),
    );
    selectedCloudService.current = createMockCloudService({ rename });
    externalAssets.current = [...assets];
    showAssetOverlay.current = true;
    renamingExternalAsset.current = undefined;
    overlaidExternalAssetId.current = undefined;
  });

  test('opens for the asset being renamed and updates the list', async () => {
    await render(RenameDialog);

    expect(page.getByRole('dialog').elements()).toHaveLength(0);

    renamingExternalAsset.current = firstAsset;

    const dialog = page.getByRole('dialog', { name: 'Rename \u2068a.png\u2069' });

    await expect.element(dialog).toBeInTheDocument();
    await waitForRenameDialog(dialog.getByRole('textbox'), 'a.png');

    // The name of another asset in the same folder is rejected, but not one in another folder
    await dialog.getByRole('textbox').fill('b.png');
    await expect.element(dialog.getByRole('button', { name: 'Rename' })).toBeDisabled();
    await dialog.getByRole('textbox').fill('c.png');
    await expect.element(dialog.getByRole('button', { name: 'Rename' })).toBeEnabled();

    await dialog.getByRole('button', { name: 'Rename' }).click();

    await vi.waitFor(() =>
      expect(rename).toHaveBeenCalledWith(firstAsset, 'c.png', expect.anything()),
    );
    await expect
      .poll(() => externalAssets.current?.map(({ id }) => id))
      .toEqual(['images/c.png', 'images/b.png', 'other/c.png']);
    await expect.poll(() => renamingExternalAsset.current).toBeUndefined();
  });

  test('keeps the details overlay on the renamed asset', async () => {
    window.location.hash = '#/assets/-/test_cloud/images/a.png';
    overlaidExternalAssetId.current = 'images/a.png';

    await render(RenameDialog);

    renamingExternalAsset.current = firstAsset;

    const dialog = page.getByRole('dialog');

    // Wait for the current name to be filled in before replacing it
    await waitForRenameDialog(dialog.getByRole('textbox'), 'a.png');
    await dialog.getByRole('textbox').fill('d.png');
    await dialog.getByRole('button', { name: 'Rename' }).click();

    await expect.poll(() => overlaidExternalAssetId.current).toBe('images/d.png');
    await expect.poll(() => window.location.hash).toBe('#/assets/-/test_cloud/images/d.png');
  });
});
