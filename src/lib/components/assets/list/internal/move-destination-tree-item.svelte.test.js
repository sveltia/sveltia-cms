import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { createMockAssetFolder, createMockCloudService } from '$lib/test/config';

import MoveDestinationTreeItem from './move-destination-tree-item.svelte';

/**
 * @import { AssetMoveDestination } from '$lib/types/private';
 */

const folder = createMockAssetFolder({ icon: 'photo_library' });
/** @type {AssetMoveDestination} */
const grandchild = { folder, dirPath: 'static/uploads/2024/05', label: '05', children: [] };
/** @type {AssetMoveDestination} */
const child = { folder, dirPath: 'static/uploads/2024', label: '2024', children: [grandchild] };
/** @type {AssetMoveDestination} */
const root = { folder, dirPath: 'static/uploads', label: 'Global Assets', children: [child] };
const service = createMockCloudService();
/** @type {AssetMoveDestination} */
const serviceFolder = { service, dirPath: 'images', label: 'images', children: [] };

/** @type {AssetMoveDestination} */
const serviceRoot = {
  service,
  dirPath: '',
  label: 'Test Cloud',
  children: [serviceFolder],
};

/**
 * Get a tree item, which may be in a collapsed branch, out of the accessibility tree.
 * @param {string} label Item label.
 * @returns {HTMLElement} Element.
 */
const getItem = (label) =>
  /** @type {HTMLElement} */ (document.querySelector(`[role="treeitem"][data-label="${label}"]`));

/**
 * Get the text of a tree item’s own row, without its subfolders: the chevron, icon and label.
 * @param {string} label Item label.
 * @returns {string | undefined} Text.
 */
const getRowText = (label) =>
  getItem(label).querySelector(':scope > .row')?.textContent?.replace(/\s+/g, ' ').trim();

describe('MoveDestinationTreeItem', () => {
  test('shows the folder with its subfolders, the root with the folder’s icon', async () => {
    await render(MoveDestinationTreeItem, {
      destination: root,
      selectedDestination: undefined,
      onSelectDestination: vi.fn(),
    });

    const item = page.getByRole('treeitem', { name: 'Global Assets' });

    await expect.element(item).toHaveAttribute('aria-level', '1');
    await expect.element(item).toHaveAttribute('aria-selected', 'false');
    await expect.element(item).toHaveAttribute('aria-expanded', 'false');
    expect(getRowText('Global Assets')).toMatch(/\bphoto_library Global Assets$/);
    // A subfolder gets the plain folder icon
    expect(getRowText('2024')).toMatch(/\bfolder 2024$/);
    expect(getItem('2024')).toHaveAttribute('aria-level', '2');
    // A folder without subfolders isn’t a parent node
    expect(getItem('05')).not.toHaveAttribute('aria-expanded');
  });

  test('gives the root of a folder without an icon the plain folder icon', async () => {
    await render(MoveDestinationTreeItem, {
      destination: { ...root, folder: createMockAssetFolder(), children: [] },
      selectedDestination: undefined,
      onSelectDestination: vi.fn(),
    });

    expect(getRowText('Global Assets')).toMatch(/^folder Global Assets$/);
  });

  test('selects the folder given and expands the branch holding it', async () => {
    await render(MoveDestinationTreeItem, {
      destination: root,
      selectedDestination: grandchild,
      onSelectDestination: vi.fn(),
    });

    await expect
      .element(page.getByRole('treeitem', { name: 'Global Assets' }))
      .toHaveAttribute('aria-expanded', 'true');
    await expect
      .element(page.getByRole('treeitem', { name: '2024', exact: true }))
      .toHaveAttribute('aria-expanded', 'true');
    await expect
      .element(page.getByRole('treeitem', { name: '05', exact: true }))
      .toHaveAttribute('aria-selected', 'true');
    await expect
      .element(page.getByRole('treeitem', { name: 'Global Assets' }))
      .toHaveAttribute('aria-selected', 'false');
  });

  test('reports the folder picked in the tree', async () => {
    const onSelectDestination = vi.fn();

    await render(MoveDestinationTreeItem, {
      destination: root,
      selectedDestination: undefined,
      onSelectDestination,
    });

    // The parent `Tree` widget dispatches the event on the item picked
    getItem('05').dispatchEvent(new CustomEvent('Select'));
    expect(onSelectDestination).toHaveBeenCalledExactlyOnceWith(grandchild);
  });

  test('shows a cloud storage service with the cloud icon, and its folders', async () => {
    await render(MoveDestinationTreeItem, {
      destination: serviceRoot,
      selectedDestination: undefined,
      onSelectDestination: vi.fn(),
    });

    const item = page.getByRole('treeitem', { name: 'Test Cloud' });

    await expect.element(item).toHaveAttribute('aria-expanded', 'false');
    expect(getRowText('Test Cloud')).toMatch(/\bcloud Test Cloud$/);
    expect(getRowText('images')).toMatch(/^folder images$/);
  });

  test('selects a folder on a service and expands the service holding it', async () => {
    const onSelectDestination = vi.fn();

    await render(MoveDestinationTreeItem, {
      destination: serviceRoot,
      // A copy, as the destination is matched by its service and path
      selectedDestination: { ...serviceFolder },
      onSelectDestination,
    });

    await expect
      .element(page.getByRole('treeitem', { name: 'Test Cloud' }))
      .toHaveAttribute('aria-expanded', 'true');
    await expect
      .element(page.getByRole('treeitem', { name: 'Test Cloud' }))
      .toHaveAttribute('aria-selected', 'false');
    await expect
      .element(page.getByRole('treeitem', { name: 'images', exact: true }))
      .toHaveAttribute('aria-selected', 'true');

    getItem('images').dispatchEvent(new CustomEvent('Select'));
    expect(onSelectDestination).toHaveBeenCalledExactlyOnceWith(serviceFolder);
  });

  test('doesn’t take a repository folder for a folder on a service of the same path', async () => {
    await render(MoveDestinationTreeItem, {
      destination: serviceRoot,
      selectedDestination: { folder, dirPath: 'images', label: 'images', children: [] },
      onSelectDestination: vi.fn(),
    });

    await expect
      .element(page.getByRole('treeitem', { name: 'Test Cloud' }))
      .toHaveAttribute('aria-expanded', 'false');
    expect(getItem('images')).toHaveAttribute('aria-selected', 'false');
  });
});
