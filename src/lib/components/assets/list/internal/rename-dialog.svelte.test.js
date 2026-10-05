import { sleep } from '@sveltia/utils/misc';
import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { moveAssets } from '$lib/services/assets/data/move';
import { getAssetUsedEntries } from '$lib/services/assets/details';
import { renamingAsset } from '$lib/services/assets/state';
import { showAssetOverlay } from '$lib/services/assets/view';
import { isEntryReadonly } from '$lib/services/contents/entry/readonly';
import { createMockAsset, initTestConfig, setAssets } from '$lib/test/config';
import { expectFileNameSelected } from '$lib/test/dialog';

import RenameDialog from './rename-dialog.svelte';

vi.mock('$lib/services/assets/data/move', () => ({
  getDraftBaseProps: vi.fn(),
  addSavingEntryData: vi.fn(),
  collectEntryChanges: vi.fn(),
  collectEntryChangesFromAssets: vi.fn(),
  updateStores: vi.fn(),
  moveAssets: vi.fn(),
}));

vi.mock('$lib/services/assets/details', async (importOriginal) => {
  const actual = /** @type {any} */ (await importOriginal());

  return { ...actual, getAssetUsedEntries: vi.fn(actual.getAssetUsedEntries) };
});

vi.mock('$lib/services/contents/entry/readonly', () => ({
  isEntryReadonly: vi.fn(() => false),
  getReadonlyEntryLabel: vi.fn((entry) => `Archive › ${entry.slug}`),
}));

const assets = [createMockAsset({ name: 'a.png' }), createMockAsset({ name: 'b.png' })];
const [firstAsset, secondAsset] = assets;

describe('RenameDialog', () => {
  beforeAll(async () => {
    await initTestConfig({ site_url: 'https://example.com' });
    setAssets(assets);
  });

  beforeEach(() => {
    showAssetOverlay.current = true;
    renamingAsset.current = undefined;
    vi.mocked(moveAssets).mockResolvedValue(undefined);
  });

  test('opens for the asset being renamed and moves it', async () => {
    window.location.hash = '#/assets/static/uploads/a.png';

    await render(RenameDialog);

    expect(page.getByRole('dialog').elements()).toHaveLength(0);

    renamingAsset.current = firstAsset;

    const dialog = page.getByRole('dialog', { name: 'Rename \u2068a.png\u2069' });

    await expect.element(dialog).toBeInTheDocument();
    await expectFileNameSelected(dialog.getByRole('textbox'), 'a.png');

    // The name of another asset in the folder is rejected
    await dialog.getByRole('textbox').fill('b.png');
    await expect.element(dialog.getByRole('button', { name: 'Rename' })).toBeDisabled();

    await dialog.getByRole('textbox').fill('c.png');
    await dialog.getByRole('button', { name: 'Rename' }).click();

    await vi.waitFor(() =>
      expect(moveAssets).toHaveBeenCalledWith('rename', [
        { asset: firstAsset, path: 'static/uploads/c.png' },
      ]),
    );
    // The details overlay of the asset stays open
    await expect.poll(() => window.location.hash).toBe('#/assets/static/uploads/c.png');
    await expect.poll(() => renamingAsset.current).toBeUndefined();
  });

  test('slugifies the new name with the `slugify_filename` option', async () => {
    const config = { site_url: 'https://example.com' };

    await initTestConfig({
      ...config,
      media_libraries: { default: { config: { slugify_filename: true } } },
    });

    try {
      await render(RenameDialog);

      renamingAsset.current = firstAsset;

      const dialog = page.getByRole('dialog', { name: 'Rename \u2068a.png\u2069' });

      await expectFileNameSelected(dialog.getByRole('textbox'), 'a.png');
      await dialog.getByRole('textbox').fill('Blog Photo 1.png');
      await expect
        .element(dialog.getByRole('status'))
        .toHaveTextContent('The file will be saved as “\u2068blog-photo-1.png\u2069”.');
      await dialog.getByRole('button', { name: 'Rename' }).click();

      await vi.waitFor(() =>
        expect(moveAssets).toHaveBeenCalledWith('rename', [
          { asset: firstAsset, path: 'static/uploads/blog-photo-1.png' },
        ]),
      );
    } finally {
      await initTestConfig(config);
    }
  });

  test('refuses to rename an asset a read-only entry uses', async () => {
    const entry = /** @type {any} */ ({ id: 'old', slug: 'old-post', locales: {} });

    vi.mocked(getAssetUsedEntries).mockResolvedValueOnce([entry]);
    vi.mocked(isEntryReadonly).mockReturnValue(true);

    try {
      await render(RenameDialog);

      renamingAsset.current = firstAsset;

      const dialog = page.getByRole('dialog', { name: 'Rename \u2068a.png\u2069' });

      await expect
        .element(dialog.getByRole('alert'))
        .toHaveTextContent(
          'This asset can’t be moved or renamed, because the following read-only entries use it: ' +
            '\u2068Archive › old-post\u2069.',
        );
      await expect.element(dialog.getByRole('button', { name: 'Rename' })).toBeDisabled();
      expect(isEntryReadonly).toHaveBeenCalledWith(entry);
    } finally {
      vi.mocked(isEntryReadonly).mockReturnValue(false);
    }
  });

  test('ignores the entries of the asset renamed before, when they’re found late', async () => {
    const entry = /** @type {any} */ ({ id: 'old', slug: 'old-post', locales: {} });
    const { promise, resolve } = Promise.withResolvers();

    vi.mocked(getAssetUsedEntries)
      .mockReturnValueOnce(/** @type {Promise<any>} */ (promise))
      .mockResolvedValueOnce([]);
    vi.mocked(isEntryReadonly).mockReturnValue(true);

    try {
      await render(RenameDialog);

      renamingAsset.current = firstAsset;
      await vi.waitFor(() => expect(getAssetUsedEntries).toHaveBeenCalledOnce());
      renamingAsset.current = secondAsset;

      const dialog = page.getByRole('dialog');

      await expectFileNameSelected(dialog.getByRole('textbox'), 'b.png');
      // The entries using the first asset are found after that
      resolve([entry]);
      await promise;
      await sleep(50);

      expect(dialog.getByRole('alert').elements()).toHaveLength(0);
    } finally {
      vi.mocked(isEntryReadonly).mockReturnValue(false);
    }
  });

  test('leaves the URL alone when the asset isn’t shown', async () => {
    window.location.hash = '#/assets';

    await render(RenameDialog);

    renamingAsset.current = secondAsset;

    const dialog = page.getByRole('dialog');

    await expectFileNameSelected(dialog.getByRole('textbox'), 'b.png');
    await dialog.getByRole('textbox').fill('c.png');
    await dialog.getByRole('button', { name: 'Rename' }).click();

    await vi.waitFor(() => expect(moveAssets).toHaveBeenCalledOnce());
    expect(window.location.hash).toBe('#/assets');
  });
});
