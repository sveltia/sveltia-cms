import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import {
  externalAssets,
  externalFolders,
  selectedCloudService,
  selectedExternalDirPath,
  showNewExternalFolderDialog,
} from '$lib/services/assets/external';
import { createMockCloudService, createMockExternalAsset } from '$lib/test/config';

import NewFolderDialog from './new-folder-dialog.svelte';

describe('NewFolderDialog', () => {
  /** @type {import('vitest').Mock} */
  let createFolder;

  beforeEach(() => {
    createFolder = vi.fn().mockResolvedValue(undefined);
    selectedCloudService.current = createMockCloudService({ browse: vi.fn(), createFolder });
    externalAssets.current = [createMockExternalAsset({ fileName: 'a.png' })];
    externalFolders.current = ['images/empty'];
    selectedExternalDirPath.current = 'images';
    showNewExternalFolderDialog.current = false;
  });

  test('creates a folder in the folder being browsed, rejecting a taken name', async () => {
    await render(NewFolderDialog);

    expect(page.getByRole('dialog').elements()).toHaveLength(0);

    showNewExternalFolderDialog.current = true;

    const dialog = page.getByRole('dialog', { name: 'New Folder' });

    await expect.element(dialog).toMatchTextContent('created in “\u2068/images\u2069”');

    // A subfolder or a file already in the folder can’t be taken over
    await dialog.getByRole('textbox').fill('empty');
    await expect.element(dialog.getByRole('button', { name: 'Create' })).toBeDisabled();
    await dialog.getByRole('textbox').fill('a.png');
    await expect.element(dialog.getByRole('button', { name: 'Create' })).toBeDisabled();

    await dialog.getByRole('textbox').fill('2024');
    await dialog.getByRole('button', { name: 'Create' }).click();

    await vi.waitFor(() =>
      expect(createFolder).toHaveBeenCalledWith('images/2024', expect.anything()),
    );
    await expect.poll(() => externalFolders.current).toEqual(['images/empty', 'images/2024']);
    await expect.poll(() => showNewExternalFolderDialog.current).toBe(false);
  });

  test('names the service at its root', async () => {
    selectedExternalDirPath.current = '';

    await render(NewFolderDialog);

    showNewExternalFolderDialog.current = true;

    await expect
      .element(page.getByRole('dialog', { name: 'New Folder' }))
      .toMatchTextContent('created in “\u2068Test Cloud\u2069”');
  });
});
