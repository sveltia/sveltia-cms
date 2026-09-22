import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import {
  externalAssets,
  externalFolders,
  focusedExternalAsset,
  focusedExternalSubfolder,
  selectedCloudService,
  selectedExternalAssets,
  selectedExternalDirPath,
  showNewExternalFolderDialog,
} from '$lib/services/assets/external';
import { externalAssetsToast, uploadingExternalAssets } from '$lib/services/assets/external/data';
import { currentView } from '$lib/services/assets/view/settings';
import { env } from '$lib/services/user/env.svelte';
import {
  createMockCloudService,
  createMockExternalAsset,
  createMockImageFile,
  initTestConfig,
  setEntries,
} from '$lib/test/config';
import { waitForToastsToHide } from '$lib/test/toast';

import MainArea from './main-area.svelte';

const assets = [
  createMockExternalAsset({ fileName: 'a.png' }),
  createMockExternalAsset({ fileName: 'b.png' }),
];

const [firstAsset] = assets;

describe('MainArea', () => {
  beforeEach(async () => {
    await initTestConfig({ media_libraries: { all: { max_file_size: 1000 } } });
    setEntries([]);
    env.isLargeScreen = true;
    currentView.current = { type: 'grid', showInfo: true };
    externalAssets.current = [...assets];
    externalFolders.current = [];
    selectedExternalDirPath.current = '';
    focusedExternalAsset.current = undefined;
    focusedExternalSubfolder.current = undefined;
    showNewExternalFolderDialog.current = false;
    selectedExternalAssets.current = [];
    uploadingExternalAssets.current = { files: [] };
    externalAssetsToast.current = { show: false, status: 'info', message: '' };
  });

  test('lays out the toolbars, list and info pane', async () => {
    selectedCloudService.current = createMockCloudService({ upload: vi.fn() });

    await render(MainArea);

    const area = page.getByRole('main', { name: '\u2068Test Cloud\u2069 Asset Folder' });

    await expect.element(area).toHaveAttribute('id', 'assets-container');
    await expect.element(area.getByRole('grid', { name: 'Assets' })).toBeInTheDocument();
    await expect.element(area.getByRole('toolbar', { name: 'Folder' })).toBeInTheDocument();
    await expect.element(area.getByRole('toolbar', { name: 'Asset List' })).toBeInTheDocument();
    await expect
      .element(area.getByRole('group', { name: 'Asset Info' }))
      .toHaveTextContent('Select an asset to show its info.');

    focusedExternalAsset.current = firstAsset;
    await expect
      .element(
        area.getByRole('group', { name: 'Asset Info' }).getByRole('heading', { name: 'Kind' }),
      )
      .toBeInTheDocument();
  });

  test('describes the folder in the info pane and offers the folder dialogs', async () => {
    selectedCloudService.current = createMockCloudService({
      browse: vi.fn(),
      createFolder: vi.fn(),
    });
    selectedExternalDirPath.current = 'images';

    await render(MainArea);

    const area = page.getByRole('main', { name: '\u2068Test Cloud\u2069 Asset Folder' });
    const info = area.getByRole('group', { name: 'Asset Info' });

    // The folder being browsed is described while no asset is focused
    await expect.element(info).toMatchTextContent('Folder images Folder Path /images');

    focusedExternalSubfolder.current = { name: '2024', path: 'images/2024' };
    await expect.element(info).toMatchTextContent('Folder 2024 Folder Path /images/2024');

    showNewExternalFolderDialog.current = true;
    await expect.element(page.getByRole('dialog', { name: 'New Folder' })).toBeInTheDocument();
  });

  test('uploads the files handed over, reporting the rejected ones', async () => {
    const upload = vi.fn(async (/** @type {File[]} */ files) =>
      files.map((file) => createMockExternalAsset({ fileName: file.name })),
    );

    selectedCloudService.current = createMockCloudService({ upload });

    await render(MainArea);

    const valid = await createMockImageFile({ name: 'c.png' });
    const oversized = new File([new Uint8Array(2000)], 'big.txt', { type: 'text/plain' });
    const invalid = new File(['x'], 'broken.png', { type: 'image/png' });

    uploadingExternalAssets.current = { files: [valid, oversized, invalid] };

    await vi.waitFor(() => expect(upload).toHaveBeenCalledWith([valid], expect.anything()));
    await expect
      .poll(() => externalAssets.current?.map(({ id }) => id))
      .toEqual(['images/c.png', 'images/a.png', 'images/b.png']);

    const dialog = page.getByRole('alertdialog', { name: 'Files Cannot Be Uploaded' });

    await expect.element(dialog).toBeInTheDocument();
    expect(dialog.element().textContent).toContain('big.txt');
    expect(dialog.element().textContent).toContain('broken.png');
    await dialog.getByRole('button', { name: 'OK' }).click();
    await expect.poll(() => document.querySelector('[role="alertdialog"]')).toBeNull();

    // Nothing to report
    const another = await createMockImageFile({ name: 'd.png' });

    uploadingExternalAssets.current = { files: [another] };
    await vi.waitFor(() => expect(upload).toHaveBeenCalledWith([another], expect.anything()));
    await expect.poll(() => externalAssets.current?.length).toBe(4);
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();

    // Only an invalid file
    uploadingExternalAssets.current = { files: [invalid] };
    await expect.element(page.getByRole('alertdialog', { name: 'Invalid File' })).toBeVisible();
  });

  test('shows the toast for the service', async () => {
    selectedCloudService.current = createMockCloudService();

    await render(MainArea);

    externalAssetsToast.current = {
      show: true,
      status: 'error',
      message: 'uploading_files_failed',
    };

    await expect
      .poll(() =>
        document.querySelector('.sui.alert.error')?.textContent?.replace(/\s+/g, ' ').trim(),
      )
      .toBe('error Error Upload failed.');
    // The toast goes away on its own, resetting the state
    await waitForToastsToHide();
    expect(externalAssetsToast.current.show).toBe(false);
  });

  test('hides the secondary toolbar until the list is loaded', async () => {
    selectedCloudService.current = createMockCloudService();
    externalAssets.current = undefined;

    await render(MainArea);

    expect(page.getByRole('toolbar', { name: 'Asset List' }).elements()).toHaveLength(0);
  });
});
