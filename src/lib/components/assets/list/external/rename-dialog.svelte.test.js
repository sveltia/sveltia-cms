import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import {
  externalAssets,
  overlaidExternalAssetId,
  renamingExternalAsset,
  selectedCloudService,
} from '$lib/services/assets/external';
import { getExternalAssetUsedEntries } from '$lib/services/assets/external/details';
import { showAssetOverlay } from '$lib/services/assets/view';
import { createMockCloudService, createMockExternalAsset } from '$lib/test/config';
import { expectFileNameSelected } from '$lib/test/dialog';

import RenameDialog from './rename-dialog.svelte';

vi.mock('$lib/services/assets/external/details', async (importOriginal) => ({
  .../** @type {any} */ (await importOriginal()),
  getExternalAssetUsedEntries: vi.fn(async () => []),
}));

const assets = [
  createMockExternalAsset({ fileName: 'a.png' }),
  createMockExternalAsset({ fileName: 'b.png' }),
  createMockExternalAsset({ fileName: 'c.png', folder: 'other' }),
];

const [firstAsset, secondAsset] = assets;

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
    vi.mocked(getExternalAssetUsedEntries).mockResolvedValue([]);
  });

  test('opens for the asset being renamed and updates the list', async () => {
    await render(RenameDialog);

    expect(page.getByRole('dialog').elements()).toHaveLength(0);

    renamingExternalAsset.current = firstAsset;

    const dialog = page.getByRole('dialog', { name: 'Rename \u2068a.png\u2069' });

    await expect.element(dialog).toBeInTheDocument();
    await expectFileNameSelected(dialog.getByRole('textbox'), 'a.png');

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
    await expectFileNameSelected(dialog.getByRole('textbox'), 'a.png');
    await dialog.getByRole('textbox').fill('d.png');
    await dialog.getByRole('button', { name: 'Rename' }).click();

    await expect.poll(() => overlaidExternalAssetId.current).toBe('images/d.png');
    await expect.poll(() => window.location.hash).toBe('#/assets/-/test_cloud/images/d.png');
  });

  test('warns that the links of the entries using the asset will break', async () => {
    const warning = page.getByRole('alert').filter({ hasText: 'link' });

    await render(RenameDialog);

    // No warning for an asset no entry uses
    renamingExternalAsset.current = firstAsset;
    await expect.element(page.getByRole('dialog')).toBeInTheDocument();
    await vi.waitFor(() => expect(getExternalAssetUsedEntries).toHaveBeenCalledWith(firstAsset));
    expect(warning.elements()).toHaveLength(0);
    renamingExternalAsset.current = undefined;
    await expect.poll(() => page.getByRole('dialog').elements()).toHaveLength(0);

    vi.mocked(getExternalAssetUsedEntries).mockResolvedValue(/** @type {any[]} */ ([{}, {}]));
    renamingExternalAsset.current = secondAsset;

    const dialog = page.getByRole('dialog', { name: 'Rename \u2068b.png\u2069' });

    await expect
      .element(dialog.getByRole('alert'))
      .toHaveTextContent(
        '2 entries link to this file. The entries won’t be updated, so the links will break once ' +
          'the file is renamed.',
      );

    // The asset can still be renamed
    await dialog.getByRole('textbox').fill('d.png');
    await dialog.getByRole('button', { name: 'Rename' }).click();
    await vi.waitFor(() =>
      expect(rename).toHaveBeenCalledWith(secondAsset, 'd.png', expect.anything()),
    );
  });

  test('ignores the entries of an asset no longer being renamed', async () => {
    /**
     * Resolve the pending lookup of the entries.
     * @type {(entries: any[]) => void}
     */
    let resolve = () => {};

    vi.mocked(getExternalAssetUsedEntries).mockReturnValueOnce(
      new Promise((r) => {
        resolve = r;
      }),
    );

    await render(RenameDialog);

    renamingExternalAsset.current = firstAsset;
    await vi.waitFor(() => expect(getExternalAssetUsedEntries).toHaveBeenCalledWith(firstAsset));
    renamingExternalAsset.current = secondAsset;
    await vi.waitFor(() => expect(getExternalAssetUsedEntries).toHaveBeenCalledWith(secondAsset));
    resolve([{}]);
    await new Promise((r) => {
      setTimeout(r, 50);
    });

    expect(page.getByRole('alert').elements()).toHaveLength(0);
  });
});
