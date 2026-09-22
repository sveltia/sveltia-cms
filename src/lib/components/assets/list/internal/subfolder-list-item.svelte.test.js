import { sleep } from '@sveltia/utils/misc';
import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { focusedAsset } from '$lib/services/assets';
import { globalAssetFolder, selectedAssetFolder } from '$lib/services/assets/folders';
import {
  deletingSubfolder,
  focusedSubfolder,
  renamingSubfolder,
} from '$lib/services/assets/subfolders';
import { env } from '$lib/services/user/env.svelte';
import { forkedRepository } from '$lib/services/workflow/open-authoring';
import { initTestConfig } from '$lib/test/config';

import SubfolderListItem from './subfolder-list-item.svelte';

const subfolder = { name: '2024', path: 'static/uploads/2024' };

describe('SubfolderListItem', () => {
  beforeAll(async () => {
    await initTestConfig();
  });

  beforeEach(() => {
    env.isSmallScreen = false;
    env.isMediumScreen = false;
    env.hasMouse = true;
    selectedAssetFolder.current = globalAssetFolder.current;
    renamingSubfolder.current = undefined;
    deletingSubfolder.current = undefined;
    focusedSubfolder.current = undefined;
    focusedAsset.current = undefined;
    forkedRepository.current = undefined;
    window.location.hash = '#/assets/static/uploads';
  });

  test('shows the folder as a compact tile with its name, position and menu', async () => {
    const { container } = await render(SubfolderListItem, {
      subfolder,
      rowIndex: 3,
      viewType: 'grid',
    });

    const row = page.getByRole('row', { name: '2024' });

    await expect.element(row).toHaveAttribute('aria-rowindex', '4');
    await expect.element(row).toHaveAccessibleDescription('Folder');
    await expect.element(row).toMatchTextContent('folder 2024');
    await expect.element(row.getByRole('button', { name: 'Show Folder Options' })).toBeVisible();
    // No checkbox placeholder in the grid view, where the tile is a row of its own
    expect(container.querySelectorAll('[role="gridcell"]')).toHaveLength(2);
    expect(container.querySelector('[role="row"]')).toHaveClass('subfolder');
  });

  test('shows the folder as a row aligned with the asset rows in the list view', async () => {
    const { container } = await render(SubfolderListItem, {
      subfolder,
      rowIndex: 0,
      viewType: 'list',
    });

    await expect.element(page.getByRole('row', { name: '2024' })).toMatchTextContent('folder 2024');
    // A placeholder keeps the columns aligned with the asset rows, which have a checkbox
    expect(container.querySelectorAll('[role="gridcell"]')).toHaveLength(3);
  });

  test('offers to rename or delete the folder from its menu, without opening it', async () => {
    // A click on the row opens the folder on a small screen, but not a click on its menu
    env.isSmallScreen = true;

    await render(SubfolderListItem, { subfolder, rowIndex: 0, viewType: 'grid' });

    const row = page.getByRole('row', { name: '2024' });

    /**
     * Open the folder menu.
     */
    const openMenu = async () => {
      // Wait for the previous popup to be unmounted
      await expect.poll(() => document.querySelector('dialog.popup')).toBeNull();
      await row.getByRole('button', { name: 'Show Folder Options' }).click();
      // A Sveltia UI menu starts handling clicks 100 ms after it’s opened
      await sleep(150);
    };

    await openMenu();
    await page.getByRole('menuitem', { name: 'Rename Folder' }).click();
    expect(renamingSubfolder.current).toEqual(subfolder);
    expect(window.location.hash).toBe('#/assets/static/uploads');

    await openMenu();
    await page.getByRole('menuitem', { name: 'Delete Folder' }).click();
    expect(deletingSubfolder.current).toEqual(subfolder);
    expect(window.location.hash).toBe('#/assets/static/uploads');
  });

  test('withholds renaming and deleting while contributing via a fork', async () => {
    forkedRepository.current = /** @type {any} */ ({ owner: 'me', repo: 'site' });

    await render(SubfolderListItem, { subfolder, rowIndex: 0, viewType: 'grid' });

    await page.getByRole('button', { name: 'Show Folder Options' }).click();
    await expect.element(page.getByRole('menuitem', { name: 'Rename Folder' })).toBeDisabled();
    await expect.element(page.getByRole('menuitem', { name: 'Delete Folder' })).toBeDisabled();
  });

  test('opens the folder on double click, carrying the asset folder as history state', async () => {
    focusedAsset.current = /** @type {any} */ ({ path: 'static/uploads/a.png' });

    await render(SubfolderListItem, { subfolder, rowIndex: 0, viewType: 'grid' });

    const row = page.getByRole('row', { name: '2024' });

    // A single click only focuses the row on a large screen, which shows the folder’s info in
    // place of an asset’s
    await row.click();
    expect(window.location.hash).toBe('#/assets/static/uploads');
    expect(focusedSubfolder.current).toEqual(subfolder);
    expect(focusedAsset.current).toBeUndefined();

    await row.dblClick();
    await expect.poll(() => window.location.hash).toBe('#/assets/static/uploads/2024');
    expect(window.history.state.folder).toEqual(globalAssetFolder.current);
  });

  test('opens the folder on a single click on a small screen, without the checkbox placeholder', async () => {
    env.isSmallScreen = true;

    const { container } = await render(SubfolderListItem, {
      subfolder,
      rowIndex: 0,
      viewType: 'grid',
    });

    expect(container.querySelectorAll('[role="gridcell"]')).toHaveLength(2);

    await page.getByRole('row', { name: '2024' }).click();
    await expect.poll(() => window.location.hash).toBe('#/assets/static/uploads/2024');
  });

  test('opens the folder on a click synthesized for the Enter key', async () => {
    await render(SubfolderListItem, { subfolder, rowIndex: 0, viewType: 'grid' });

    const row = page.getByRole('row', { name: '2024' });

    // The grid turns Enter on a focused row into a `click()` call, which has no pointer, and a
    // click without a pointer opens the item right away
    /** @type {HTMLElement} */ (row.element()).click();
    await expect.poll(() => window.location.hash).toBe('#/assets/static/uploads/2024');
  });
});
