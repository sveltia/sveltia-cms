import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { renamingAsset } from '$lib/services/assets';
import { moveAssets } from '$lib/services/assets/data/move';
import { showAssetOverlay } from '$lib/services/assets/view';
import { createMockAsset, initTestConfig, setAssets } from '$lib/test/config';
import { waitForRenameDialog } from '$lib/test/dialog';

import RenameDialog from './rename-dialog.svelte';

vi.mock('$lib/services/assets/data/move', () => ({
  getDraftBaseProps: vi.fn(),
  addSavingEntryData: vi.fn(),
  collectEntryChanges: vi.fn(),
  collectEntryChangesFromAsset: vi.fn(),
  updateStores: vi.fn(),
  moveAssets: vi.fn(),
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
    await waitForRenameDialog(dialog.getByRole('textbox'), 'a.png');

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

  test('leaves the URL alone when the asset isn’t shown', async () => {
    window.location.hash = '#/assets';

    await render(RenameDialog);

    renamingAsset.current = secondAsset;

    const dialog = page.getByRole('dialog');

    await dialog.getByRole('textbox').fill('c.png');
    await dialog.getByRole('button', { name: 'Rename' }).click();

    await vi.waitFor(() => expect(moveAssets).toHaveBeenCalledOnce());
    expect(window.location.hash).toBe('#/assets');
  });
});
