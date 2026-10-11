import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { env } from '$lib/services/user/env.svelte';

import SubfolderListItem from './subfolder-list-item.svelte';

const subfolder = { name: '2024', path: 'static/uploads/2024' };

/**
 * Open the folder menu once the previous popup has gone.
 */
const openMenu = async () => {
  await expect.poll(() => document.querySelector('dialog.popup[open]')).toBeNull();
  await page.getByRole('button', { name: 'Show Folder Options' }).click();
};

describe('SubfolderListItem', () => {
  beforeEach(() => {
    env.isSmallScreen = false;
    env.isMediumScreen = false;
    env.hasMouse = true;
  });

  test('shows the folder as a row, with a placeholder for the checkbox column', async () => {
    const { container } = await render(SubfolderListItem, {
      subfolder,
      rowIndex: 4,
      viewType: 'list',
      hasCheckboxColumn: true,
      onOpen: vi.fn(),
    });

    const row = page.getByRole('row', { name: '2024' });

    await expect.element(row).toHaveAttribute('aria-rowindex', '5');
    await expect.element(row).toHaveAccessibleDescription('Folder');
    await expect.element(row).toMatchTextContent('folder 2024');
    expect(container.querySelectorAll('[role="gridcell"]')).toHaveLength(3);
    expect(container.querySelector('[role="gridcell"].checkbox')).not.toBeNull();
    // Without a rename or delete handler, there is nothing to put in a menu
    expect(page.getByRole('button', { name: 'Show Folder Options' }).elements()).toHaveLength(0);
  });

  test('has no checkbox placeholder in the grid view or without a checkbox column', async () => {
    const { container, rerender } = await render(SubfolderListItem, {
      subfolder,
      rowIndex: 0,
      viewType: 'grid',
      hasCheckboxColumn: true,
      onOpen: vi.fn(),
    });

    await expect.element(page.getByRole('row', { name: '2024' })).toBeInTheDocument();
    expect(container.querySelectorAll('[role="gridcell"]')).toHaveLength(2);

    await rerender({ viewType: 'list', hasCheckboxColumn: false });
    expect(container.querySelectorAll('[role="gridcell"]')).toHaveLength(2);
  });

  test('focuses the folder on a click, and opens it on a double click', async () => {
    const onOpen = vi.fn();
    const onFocus = vi.fn();

    await render(SubfolderListItem, { subfolder, rowIndex: 0, viewType: 'grid', onOpen, onFocus });

    const row = page.getByRole('row', { name: '2024' });

    await row.click();
    expect(onFocus).toHaveBeenCalled();
    expect(onOpen).not.toHaveBeenCalled();

    await row.dblClick();
    expect(onOpen).toHaveBeenCalled();
  });

  test('opens the folder on a single click on a small screen', async () => {
    const onOpen = vi.fn();

    env.isSmallScreen = true;

    // No focus handler is needed either
    await render(SubfolderListItem, { subfolder, rowIndex: 0, viewType: 'grid', onOpen });

    await page.getByRole('row', { name: '2024' }).click();
    expect(onOpen).toHaveBeenCalledOnce();
  });

  test('offers to rename or delete the folder from its menu, without opening it', async () => {
    const onOpen = vi.fn();
    const onRename = vi.fn();
    const onDelete = vi.fn();

    await render(SubfolderListItem, {
      subfolder,
      rowIndex: 0,
      viewType: 'grid',
      onOpen,
      onRename,
      onDelete,
    });

    await openMenu();
    await expect.element(page.getByRole('menu', { name: 'Folder Options' })).toBeVisible();
    await page.getByRole('menuitem', { name: 'Rename Folder' }).click();
    expect(onRename).toHaveBeenCalledOnce();

    await openMenu();
    await page.getByRole('menuitem', { name: 'Delete Folder' }).click();
    expect(onDelete).toHaveBeenCalledOnce();

    // Neither a click nor a double click on the menu reaches the row
    await expect.poll(() => document.querySelector('dialog.popup[open]')).toBeNull();
    await page.getByRole('button', { name: 'Show Folder Options' }).dblClick();
    await userEvent.keyboard('{Escape}');
    expect(onOpen).not.toHaveBeenCalled();
  });

  test('offers only the actions it has handlers for, and can disable them', async () => {
    const { rerender } = await render(SubfolderListItem, {
      subfolder,
      rowIndex: 0,
      viewType: 'list',
      onOpen: vi.fn(),
      onDelete: vi.fn(),
      actionsDisabled: true,
    });

    await openMenu();
    await expect.element(page.getByRole('menuitem', { name: 'Delete Folder' })).toBeDisabled();
    expect(page.getByRole('menuitem', { name: 'Rename Folder' }).elements()).toHaveLength(0);
    await userEvent.keyboard('{Escape}');

    await rerender({ onDelete: undefined, onRename: vi.fn() });
    await openMenu();
    await expect.element(page.getByRole('menuitem', { name: 'Rename Folder' })).toBeDisabled();
    expect(page.getByRole('menuitem', { name: 'Delete Folder' }).elements()).toHaveLength(0);
    await userEvent.keyboard('{Escape}');
  });
});
