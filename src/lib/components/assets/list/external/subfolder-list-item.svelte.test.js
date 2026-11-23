import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { ASSET_DRAG_TYPE } from '$lib/services/assets/drag';
import {
  deletingExternalSubfolder,
  focusedExternalAsset,
  focusedExternalSubfolder,
  renamingExternalSubfolder,
  selectedCloudService,
  selectedExternalAssets,
  selectedExternalDirPath,
} from '$lib/services/assets/external';
import { assetMoveRequest, draggedFiles } from '$lib/services/assets/state';
import { env } from '$lib/services/user/env.svelte';
import { createMockCloudService, createMockExternalAsset } from '$lib/test/config';

import SubfolderListItem from './subfolder-list-item.svelte';

const subfolder = { name: '2024', path: 'images/2024' };

/**
 * Fire a drag event carrying files dragged from the list on the given element. The data transfer
 * is a stand-in, as Chrome ignores a drop effect set on a real one outside a real drag.
 * @param {Element} element Element.
 * @param {string} type Event type.
 * @returns {{ event: Event, dataTransfer: { types: string[], dropEffect: string } }} Event and
 * its data transfer, holding the resulting drop effect.
 */
const dragFiles = (element, type) => {
  const dataTransfer = { types: [ASSET_DRAG_TYPE], dropEffect: '' };
  const event = new Event(type, { bubbles: true, cancelable: true });

  Object.defineProperty(event, 'dataTransfer', { value: dataTransfer });
  element.dispatchEvent(event);

  return { event, dataTransfer };
};

const folderService = {
  browse: vi.fn(),
  move: vi.fn(),
  delete: vi.fn(),
  createFolder: vi.fn(),
  deleteFolder: vi.fn(),
};

describe('SubfolderListItem', () => {
  beforeEach(() => {
    env.isSmallScreen = false;
    env.isMediumScreen = false;
    env.hasMouse = true;
    selectedCloudService.current = createMockCloudService(folderService);
    selectedExternalDirPath.current = '';
    selectedExternalAssets.current = [];
    renamingExternalSubfolder.current = undefined;
    deletingExternalSubfolder.current = undefined;
    focusedExternalSubfolder.current = undefined;
    focusedExternalAsset.current = undefined;
    assetMoveRequest.current = undefined;
    draggedFiles.current = undefined;
  });

  test('shows the folder as a row aligned with the asset rows in the list view', async () => {
    const { container } = await render(SubfolderListItem, {
      subfolder,
      rowIndex: 2,
      viewType: 'list',
    });

    const row = page.getByRole('row', { name: '2024' });

    await expect.element(row).toHaveAttribute('aria-rowindex', '3');
    await expect.element(row).toMatchTextContent('folder 2024');
    // A placeholder keeps the columns aligned with the asset rows, which have a checkbox
    expect(container.querySelectorAll('[role="gridcell"]')).toHaveLength(3);
  });

  test('offers to rename or delete the folder from its menu, without opening it', async () => {
    env.isSmallScreen = true;

    await render(SubfolderListItem, { subfolder, rowIndex: 0, viewType: 'grid' });

    const row = page.getByRole('row', { name: '2024' });

    /**
     * Open the folder menu.
     */
    const openMenu = async () => {
      await expect.poll(() => document.querySelector('dialog.popup')).toBeNull();
      await row.getByRole('button', { name: 'Show Folder Options' }).click();
    };

    await openMenu();
    await page.getByRole('menuitem', { name: 'Rename Folder' }).click();
    expect(renamingExternalSubfolder.current).toEqual(subfolder);
    expect(selectedExternalDirPath.current).toBe('');

    await openMenu();
    await page.getByRole('menuitem', { name: 'Delete Folder' }).click();
    expect(deletingExternalSubfolder.current).toEqual(subfolder);
    expect(selectedExternalDirPath.current).toBe('');
  });

  test('has no menu on a service that can neither move nor delete a file', async () => {
    selectedCloudService.current = createMockCloudService({ browse: vi.fn() });

    await render(SubfolderListItem, { subfolder, rowIndex: 0, viewType: 'grid' });

    await expect.element(page.getByRole('row', { name: '2024' })).toBeInTheDocument();
    expect(page.getByRole('button', { name: 'Show Folder Options' }).elements()).toHaveLength(0);
  });

  test('focuses the folder on a click, and opens it on a double click', async () => {
    const asset = createMockExternalAsset({ fileName: 'a.png' });

    focusedExternalAsset.current = asset;
    selectedExternalAssets.current = [asset];

    await render(SubfolderListItem, { subfolder, rowIndex: 0, viewType: 'grid' });

    const row = page.getByRole('row', { name: '2024' });

    // A single click only focuses the row on a large screen, which shows the folder’s info in
    // place of an asset’s
    await row.click();
    expect(selectedExternalDirPath.current).toBe('');
    expect(focusedExternalSubfolder.current).toEqual(subfolder);
    expect(focusedExternalAsset.current).toBeUndefined();

    await row.dblClick();
    expect(selectedExternalDirPath.current).toBe('images/2024');
    expect(focusedExternalSubfolder.current).toBeUndefined();
    expect(selectedExternalAssets.current).toEqual([]);
  });

  test('opens the folder on a single click on a small screen', async () => {
    env.isSmallScreen = true;

    await render(SubfolderListItem, { subfolder, rowIndex: 0, viewType: 'grid' });

    await page.getByRole('row', { name: '2024' }).click();
    expect(selectedExternalDirPath.current).toBe('images/2024');
  });

  test('takes the files on the service dropped on it, to be moved there', async () => {
    const service = createMockCloudService({
      ...folderService,
      upload: vi.fn(),
      listFolder: vi.fn(),
    });

    const asset = createMockExternalAsset({ fileName: 'a.png' });

    selectedCloudService.current = service;
    draggedFiles.current = { externalAssets: [asset], service };

    await render(SubfolderListItem, { subfolder, rowIndex: 0, viewType: 'list' });

    const row = page.getByRole('row', { name: '2024' });

    expect(dragFiles(row.element(), 'dragover').dataTransfer.dropEffect).toBe('move');
    await expect.element(row).toHaveClass('dragover');

    dragFiles(row.element(), 'drop');
    await expect.element(row).not.toHaveClass('dragover');
    expect(assetMoveRequest.current).toEqual({
      externalAssets: [asset],
      service,
      dirPath: 'images/2024',
      serviceId: 'test_cloud',
    });
    expect(draggedFiles.current).toBeUndefined();

    // A file already in the folder stays where it is, so there’s nothing to move
    assetMoveRequest.current = undefined;
    draggedFiles.current = {
      externalAssets: [createMockExternalAsset({ fileName: 'b.png', folder: 'images/2024' })],
      service,
    };

    expect(dragFiles(row.element(), 'dragover').dataTransfer.dropEffect).toBe('none');
    await expect.element(row).not.toHaveClass('dragover');
    dragFiles(row.element(), 'drop');
    expect(assetMoveRequest.current).toBeUndefined();
  });
});
