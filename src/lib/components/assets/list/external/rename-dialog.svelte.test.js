import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
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
import { lockedBranch } from '$lib/services/backends/branch-access';
import { isEntryReadonly } from '$lib/services/contents/entry/readonly';
import { createMockCloudService, createMockExternalAsset } from '$lib/test/config';
import { expectFileNameSelected } from '$lib/test/dialog';

import RenameDialog from './rename-dialog.svelte';

vi.mock('$lib/services/assets/external/details', async (importOriginal) => ({
  .../** @type {any} */ (await importOriginal()),
  getExternalAssetUsedEntries: vi.fn(async () => []),
}));

// The blocked message is worked out by the real functions, with the mocked read-only checks below
vi.mock('$lib/services/contents/entry/readonly', () => ({
  isEntryReadonly: vi.fn(() => false),
  getReadonlyEntryLabel: vi.fn((entry) => `Archive › ${entry.slug}`),
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

  afterEach(() => {
    vi.mocked(isEntryReadonly).mockReturnValue(false);
    lockedBranch.current = undefined;
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

  test('says the entries using the asset will be updated as well', async () => {
    await render(RenameDialog);

    // No entry uses the first asset
    renamingExternalAsset.current = firstAsset;

    let dialog = page.getByRole('dialog', { name: 'Rename \u2068a.png\u2069' });

    await vi.waitFor(() => expect(getExternalAssetUsedEntries).toHaveBeenCalledWith(firstAsset));
    await expect.element(dialog).toMatchTextContent('Enter a new name below.');
    expect(dialog.element().textContent).not.toContain('will also be updated');
    renamingExternalAsset.current = undefined;
    await expect.poll(() => page.getByRole('dialog').elements()).toHaveLength(0);

    vi.mocked(getExternalAssetUsedEntries).mockResolvedValue(
      /** @type {any[]} */ ([{ slug: 'a' }, { slug: 'b' }]),
    );
    renamingExternalAsset.current = secondAsset;
    dialog = page.getByRole('dialog', { name: 'Rename \u2068b.png\u2069' });

    await expect
      .element(dialog)
      .toMatchTextContent(
        'Enter a new name below. 2 entries using the asset will also be updated.',
      );
    expect(dialog.getByRole('alert').elements()).toHaveLength(0);

    // The asset can be renamed
    await expectFileNameSelected(dialog.getByRole('textbox'), 'b.png');
    await dialog.getByRole('textbox').fill('d.png');
    await dialog.getByRole('button', { name: 'Rename' }).click();
    await vi.waitFor(() =>
      expect(rename).toHaveBeenCalledWith(secondAsset, 'd.png', expect.anything()),
    );
  });

  test('refuses to rename an asset a read-only entry uses', async () => {
    const entry = /** @type {any} */ ({ id: 'old', slug: 'old-post' });

    vi.mocked(getExternalAssetUsedEntries).mockResolvedValue([entry]);
    vi.mocked(isEntryReadonly).mockReturnValue(true);

    await render(RenameDialog);

    renamingExternalAsset.current = firstAsset;

    const dialog = page.getByRole('dialog', { name: 'Rename \u2068a.png\u2069' });

    await expect
      .element(dialog.getByRole('alert'))
      .toHaveTextContent(
        'This asset can’t be moved or renamed, because the following read-only entries use it: ' +
          '\u2068Archive › old-post\u2069.',
      );
    await expect.element(dialog.getByRole('textbox')).toBeDisabled();
    await expect.element(dialog.getByRole('button', { name: 'Rename' })).toBeDisabled();
    expect(isEntryReadonly).toHaveBeenCalledWith(entry);
  });

  test('refuses to rename an asset entries use while the media library is locked', async () => {
    lockedBranch.current = 'main';
    vi.mocked(getExternalAssetUsedEntries).mockResolvedValue(/** @type {any[]} */ ([{}]));

    await render(RenameDialog);

    renamingExternalAsset.current = firstAsset;

    const dialog = page.getByRole('dialog', { name: 'Rename \u2068a.png\u2069' });

    await expect
      .element(dialog.getByRole('alert'))
      .toHaveTextContent(
        'This file can’t be renamed or moved, because the entries using it can’t be updated.',
      );
    await expect.element(dialog.getByRole('textbox')).toBeDisabled();
    await expect.element(dialog.getByRole('button', { name: 'Rename' })).toBeDisabled();
  });

  test('renames an asset no entry uses while the media library is locked', async () => {
    lockedBranch.current = 'main';

    await render(RenameDialog);

    renamingExternalAsset.current = firstAsset;

    const dialog = page.getByRole('dialog', { name: 'Rename \u2068a.png\u2069' });

    await vi.waitFor(() => expect(getExternalAssetUsedEntries).toHaveBeenCalledWith(firstAsset));
    await expectFileNameSelected(dialog.getByRole('textbox'), 'a.png');
    expect(dialog.getByRole('alert').elements()).toHaveLength(0);
    await dialog.getByRole('textbox').fill('d.png');
    await dialog.getByRole('button', { name: 'Rename' }).click();
    await vi.waitFor(() =>
      expect(rename).toHaveBeenCalledWith(firstAsset, 'd.png', expect.anything()),
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
    // The entries found late would block the rename, if they were taken
    vi.mocked(isEntryReadonly).mockReturnValue(true);

    await render(RenameDialog);

    renamingExternalAsset.current = firstAsset;
    await vi.waitFor(() => expect(getExternalAssetUsedEntries).toHaveBeenCalledWith(firstAsset));
    renamingExternalAsset.current = secondAsset;
    await vi.waitFor(() => expect(getExternalAssetUsedEntries).toHaveBeenCalledWith(secondAsset));

    const dialog = page.getByRole('dialog', { name: 'Rename \u2068b.png\u2069' });

    await expect.element(dialog.getByRole('textbox')).toHaveValue('b.png');
    resolve([{ slug: 'old-post' }]);
    await new Promise((r) => {
      setTimeout(r, 50);
    });

    expect(dialog.getByRole('alert').elements()).toHaveLength(0);
    expect(dialog.element().textContent).not.toContain('will also be updated');
  });
});
