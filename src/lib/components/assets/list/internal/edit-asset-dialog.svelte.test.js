import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { editingAsset } from '$lib/services/assets';
import { saveAssets } from '$lib/services/assets/data/create';
import { showAssetOverlay } from '$lib/services/assets/view';
import { createMockAsset } from '$lib/test/config';

import EditAssetDialog from './edit-asset-dialog.svelte';

vi.mock('$lib/services/assets/data/create', () => ({
  createFileList: vi.fn(),
  updatedStores: vi.fn(),
  saveAssets: vi.fn(),
}));

const asset = createMockAsset({
  name: 'notes.txt',
  file: new File(['Hello'], 'notes.txt', { type: 'text/plain' }),
});

describe('EditAssetDialog', () => {
  beforeEach(() => {
    showAssetOverlay.current = true;
    editingAsset.current = undefined;
    vi.mocked(saveAssets).mockResolvedValue(undefined);
  });

  test('edits the text of the asset being edited and saves it', async () => {
    await render(EditAssetDialog);

    expect(page.getByRole('dialog').elements()).toHaveLength(0);

    editingAsset.current = asset;

    const dialog = page.getByRole('dialog', { name: 'Edit \u2068notes.txt\u2069' });
    const textarea = dialog.getByRole('textbox');

    await expect.element(textarea).toHaveValue('Hello');
    await expect.element(dialog.getByRole('button', { name: 'Save' })).toBeDisabled();

    await textarea.fill('Hello, world!');
    await expect.element(dialog.getByRole('button', { name: 'Save' })).toBeEnabled();

    // Long lines can be wrapped
    await dialog.getByRole('switch', { name: 'Wrap Long Lines' }).click();
    expect(dialog.element().querySelector('.wrapper')).toHaveClass('wrap');

    await dialog.getByRole('button', { name: 'Save' }).click();

    await vi.waitFor(() => expect(saveAssets).toHaveBeenCalledOnce());

    const [{ folder, files, originalAssets }, options] = vi.mocked(saveAssets).mock.calls[0];

    expect(folder).toBe(asset.folder);
    expect(originalAssets).toEqual([asset]);
    expect(files[0].name).toBe('notes.txt');
    expect(files[0].type).toBe('text/plain');
    expect(await files[0].text()).toBe('Hello, world!');
    expect(options).toEqual({ commitType: 'uploadMedia' });
    await expect.poll(() => editingAsset.current).toBeUndefined();
  });

  test('closes along with the asset details overlay', async () => {
    await render(EditAssetDialog);

    editingAsset.current = asset;
    await expect.element(page.getByRole('dialog')).toBeInTheDocument();

    showAssetOverlay.current = false;
    await expect.poll(() => page.getByRole('dialog').elements().length).toBe(0);
    await expect.poll(() => editingAsset.current).toBeUndefined();
  });
});
