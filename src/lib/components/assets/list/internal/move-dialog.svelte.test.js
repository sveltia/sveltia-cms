import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { moveAssets } from '$lib/services/assets/data/move';
import { getAssetsUsedEntries } from '$lib/services/assets/data/move-to-folder';
import { followMovedAssets, moveToDestination } from '$lib/services/assets/data/transfer';
import { getExternalMoveDestinations } from '$lib/services/assets/external/destinations';
import { allAssetFolders } from '$lib/services/assets/folders';
import { assetMoveRequest } from '$lib/services/assets/state';
import { isEntryReadonly } from '$lib/services/contents/entry/readonly';
import {
  createMockAsset,
  createMockCloudService,
  createMockExternalAsset,
  initTestConfig,
  setAssets,
} from '$lib/test/config';
import { waitForToastsToHide } from '$lib/test/toast';

import MoveDialog from './move-dialog.svelte';

/**
 * @import { Asset, AssetFolderInfo, AssetMoveDestination } from '$lib/types/private';
 */

vi.mock('$lib/services/assets/data/move', async (importOriginal) => {
  const actual = /** @type {any} */ (await importOriginal());

  return { ...actual, moveAssets: vi.fn() };
});

vi.mock('$lib/services/assets/data/move-to-folder', async (importOriginal) => {
  const actual = /** @type {any} */ (await importOriginal());

  return { ...actual, getAssetsUsedEntries: vi.fn(actual.getAssetsUsedEntries) };
});

vi.mock('$lib/services/assets/data/transfer', async (importOriginal) => {
  const actual = /** @type {any} */ (await importOriginal());

  return {
    ...actual,
    moveToDestination: vi.fn(actual.moveToDestination),
    followMovedAssets: vi.fn(actual.followMovedAssets),
  };
});

vi.mock('$lib/services/assets/external/destinations', async (importOriginal) => {
  const actual = /** @type {any} */ (await importOriginal());

  return { ...actual, getExternalMoveDestinations: vi.fn() };
});

vi.mock('$lib/services/contents/entry/readonly', () => ({
  isEntryReadonly: vi.fn(() => false),
  getReadonlyEntryLabel: vi.fn((entry) => `Archive › ${entry.slug}`),
}));

/** @type {AssetFolderInfo} */
let globalFolder;
/** @type {AssetFolderInfo} */
let postsFolder;
/** @type {Asset[]} */
let assets;

const service = createMockCloudService({
  upload: vi.fn(),
  delete: vi.fn(),
  move: vi.fn(),
  listFolder: vi.fn(async () => ({ assets: [], folders: [] })),
});

const externalAsset = createMockExternalAsset({ fileName: 'photo.png', folder: 'images' });

/** @type {AssetMoveDestination} */
const serviceImagesFolder = {
  service,
  dirPath: 'images',
  label: 'images',
  children: [],
};

/** @type {AssetMoveDestination} */
const serviceOtherFolder = {
  service,
  dirPath: 'other',
  label: 'other',
  children: [],
};

/** @type {AssetMoveDestination} */
const serviceRoot = {
  service,
  dirPath: '',
  label: 'Test Cloud',
  children: [serviceImagesFolder, serviceOtherFolder],
};

/**
 * Get the labels of the top-level folders in the destination tree.
 * @returns {(string | undefined)[]} Labels.
 */
const getRootLabels = () =>
  page
    .getByRole('tree', { name: 'Destination Folder' })
    .getByRole('treeitem')
    .elements()
    .map((el) => el.dataset.label);

/**
 * Get a folder in the destination tree, which may be in a collapsed branch.
 * @param {string} label Folder label.
 * @returns {HTMLElement} Tree item.
 */
const getItem = (label) =>
  /** @type {HTMLElement} */ (document.querySelector(`[role="treeitem"][data-label="${label}"]`));

/**
 * Pick a folder in the destination tree.
 * @param {string} label Folder label.
 */
const pick = async (label) => {
  await page.getByRole('treeitem', { name: label, exact: true }).click();
  await expect.poll(() => getItem(label).getAttribute('aria-selected')).toBe('true');
};

describe('MoveDialog', () => {
  beforeAll(async () => {
    await initTestConfig({
      media_folder: 'static/uploads',
      collections: [
        {
          name: 'posts',
          label: 'Posts',
          folder: 'content/posts',
          media_folder: '/static/posts',
          fields: [{ name: 'title', widget: 'string' }],
        },
        {
          name: 'docs',
          label: 'Docs',
          folder: 'content/docs',
          // Entry-relative, so the assets can’t be moved to the folder
          media_folder: '',
          fields: [{ name: 'title', widget: 'string' }],
        },
      ],
    });

    globalFolder = /** @type {AssetFolderInfo} */ (
      allAssetFolders.current.find(({ internalPath }) => internalPath === 'static/uploads')
    );
    postsFolder = /** @type {AssetFolderInfo} */ (
      allAssetFolders.current.find(({ internalPath }) => internalPath === 'static/posts')
    );
    assets = [
      createMockAsset({ name: 'a.png', asset: { folder: globalFolder } }),
      createMockAsset({ name: 'b.png', asset: { folder: globalFolder } }),
      // Another `a.png` in a subfolder, which takes the name there
      createMockAsset({
        name: 'a.png',
        folderPath: 'static/uploads/2024',
        asset: { folder: globalFolder },
      }),
    ];
    setAssets(assets);
  });

  beforeEach(() => {
    assetMoveRequest.current = undefined;
    vi.mocked(moveAssets).mockResolvedValue(undefined);
    vi.mocked(getExternalMoveDestinations).mockResolvedValue([]);
  });

  test('opens for the requested asset and moves it to the folder picked', async () => {
    await render(MoveDialog);

    expect(page.getByRole('dialog').elements()).toHaveLength(0);

    assetMoveRequest.current = { assets: [assets[0]] };

    const dialog = page.getByRole('dialog', { name: 'Move \u2068a.png\u2069' });
    const button = dialog.getByRole('button', { name: 'Move' });

    await expect.element(dialog).toBeVisible();
    await expect.element(dialog).toMatchTextContent('Select the folder to move to.');
    // The folders files can be added to, with their subfolders; not the entry-relative one
    expect(
      dialog
        .getByRole('tree', { name: 'Destination Folder' })
        .getByRole('treeitem')
        .elements()
        .map((el) => el.dataset.label),
    ).toEqual(['Global Assets', 'Posts']);
    expect(getItem('2024')).not.toBeNull();
    // Nothing is picked yet
    await expect.element(button).toBeDisabled();

    // The asset’s own folder
    await pick('Global Assets');
    await expect
      .element(dialog.getByRole('alert'))
      .toHaveTextContent('The asset is already in this folder.');
    await expect.element(button).toBeDisabled();

    await pick('Posts');
    await expect.element(dialog.getByRole('alert')).toHaveTextContent('');
    await expect.element(button).toBeEnabled();
    await button.click();

    await vi.waitFor(() =>
      expect(moveAssets).toHaveBeenCalledWith('move', [
        { asset: assets[0], path: 'static/posts/a.png', folder: postsFolder },
      ]),
    );
    await vi.waitFor(() =>
      expect(followMovedAssets).toHaveBeenCalledExactlyOnceWith(
        { assets: [assets[0]] },
        expect.objectContaining({ folder: postsFolder, dirPath: 'static/posts' }),
      ),
    );
    await expect.poll(() => assetMoveRequest.current).toBeUndefined();
    await expect.poll(() => document.querySelector('[role="dialog"]')).toBeNull();
  });

  test('updates the URL of the asset shown in the details view', async () => {
    window.location.hash = '#/assets/static/uploads/a.png';
    await render(MoveDialog);

    assetMoveRequest.current = { assets: [assets[0], assets[1]] };

    const dialog = page.getByRole('dialog', { name: 'Move 2 Assets' });

    await expect.element(dialog).toBeVisible();
    await pick('Posts');
    await dialog.getByRole('button', { name: 'Move' }).click();

    await expect.poll(() => window.location.hash).toBe('#/assets/static/posts/a.png');
    window.location.hash = '#/assets';
  });

  test('leaves the URL alone when the move fails', async () => {
    window.location.hash = '#/assets/static/uploads/a.png';
    vi.mocked(moveAssets).mockRejectedValue(new Error('Commit failed'));
    await render(MoveDialog);

    assetMoveRequest.current = { assets: [assets[0]] };

    const dialog = page.getByRole('dialog', { name: 'Move \u2068a.png\u2069' });

    await expect.element(dialog).toBeVisible();
    await pick('Posts');
    await dialog.getByRole('button', { name: 'Move' }).click();

    await vi.waitFor(() => expect(moveAssets).toHaveBeenCalled());
    await expect.poll(() => document.querySelector('[role="dialog"]')).toBeNull();
    expect(window.location.hash).toBe('#/assets/static/uploads/a.png');
    expect(followMovedAssets).not.toHaveBeenCalled();
    window.location.hash = '#/assets';
    await waitForToastsToHide();
  });

  test('opens with the folder the assets have been dropped on', async () => {
    await render(MoveDialog);

    assetMoveRequest.current = { assets: [assets[1]], dirPath: 'static/uploads/2024' };

    const dialog = page.getByRole('dialog', { name: 'Move \u2068b.png\u2069' });

    await expect.element(dialog).toBeVisible();
    // The branch holding the folder is expanded to show it
    await expect
      .element(dialog.getByRole('treeitem', { name: '2024', exact: true }))
      .toHaveAttribute('aria-selected', 'true');
    await expect.element(dialog.getByRole('button', { name: 'Move' })).toBeEnabled();
    await dialog.getByRole('button', { name: 'Move' }).click();

    await vi.waitFor(() =>
      expect(moveAssets).toHaveBeenCalledWith('move', [
        { asset: assets[1], path: 'static/uploads/2024/b.png', folder: globalFolder },
      ]),
    );
  });

  test('opens without a folder picked when the dropped one is gone', async () => {
    await render(MoveDialog);

    assetMoveRequest.current = { assets: [assets[1]], dirPath: 'static/missing' };

    const dialog = page.getByRole('dialog', { name: 'Move \u2068b.png\u2069' });

    await expect.element(dialog).toBeVisible();
    expect(dialog.element().querySelector('[role="treeitem"][aria-selected="true"]')).toBeNull();
    await expect.element(dialog.getByRole('button', { name: 'Move' })).toBeDisabled();
  });

  test('refuses to move assets over the files of the same names', async () => {
    await render(MoveDialog);

    assetMoveRequest.current = { assets: [assets[0], assets[1]] };

    const dialog = page.getByRole('dialog', { name: 'Move 2 Assets' });
    const button = dialog.getByRole('button', { name: 'Move' });

    await expect.element(dialog).toBeVisible();

    // Both assets are in the folder already
    await pick('Global Assets');
    await expect
      .element(dialog.getByRole('alert'))
      .toHaveTextContent('The assets are already in this folder.');
    await expect.element(button).toBeDisabled();

    // An `a.png` is there already
    await userEvent.keyboard('{ArrowRight}');
    await expect
      .element(dialog.getByRole('treeitem', { name: 'Global Assets' }))
      .toHaveAttribute('aria-expanded', 'true');
    await pick('2024');
    await expect
      .element(dialog.getByRole('alert'))
      .toHaveTextContent('The following files already exist in this folder: \u2068a.png\u2069.');
    await expect.element(dialog.getByRole('alert')).toHaveClass('error');
    await expect.element(button).toBeDisabled();

    await pick('Posts');
    await expect.element(button).toBeEnabled();
  });

  test('tells how many entries using the assets will be updated', async () => {
    const entries = /** @type {any[]} */ ([
      { id: '1', slug: 'one', locales: {} },
      { id: '2', slug: 'two', locales: {} },
    ]);

    vi.mocked(getAssetsUsedEntries).mockResolvedValueOnce(entries.slice(0, 1));

    const { unmount } = await render(MoveDialog);

    assetMoveRequest.current = { assets: [assets[0]] };
    await expect
      .element(page.getByRole('dialog'))
      .toMatchTextContent(
        'Select the folder to move to. An entry using the assets will also be updated.',
      );
    expect(getAssetsUsedEntries).toHaveBeenCalledWith([assets[0]]);
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect.poll(() => assetMoveRequest.current).toBeUndefined();
    unmount();

    vi.mocked(getAssetsUsedEntries).mockResolvedValueOnce(entries);

    await render(MoveDialog);

    assetMoveRequest.current = { assets: [assets[0]] };
    await expect
      .element(page.getByRole('dialog'))
      .toMatchTextContent(
        'Select the folder to move to. 2 entries using the assets will also be updated.',
      );
    expect(moveAssets).not.toHaveBeenCalled();
  });

  test('refuses to move assets a read-only entry uses', async () => {
    const entry = /** @type {any} */ ({ id: 'old', slug: 'old-post', locales: {} });

    vi.mocked(getAssetsUsedEntries).mockResolvedValueOnce([entry]);
    vi.mocked(isEntryReadonly).mockReturnValue(true);

    try {
      await render(MoveDialog);

      assetMoveRequest.current = { assets: [assets[0]], dirPath: 'static/posts' };

      const dialog = page.getByRole('dialog', { name: 'Move \u2068a.png\u2069' });

      await expect
        .element(dialog.getByRole('alert'))
        .toHaveTextContent(
          'This asset can’t be moved or renamed, because the following read-only entries use it: ' +
            '\u2068Archive › old-post\u2069.',
        );
      expect(dialog.getByRole('tree').elements()).toHaveLength(0);
      await expect.element(dialog.getByRole('button', { name: 'Move' })).toBeDisabled();
    } finally {
      vi.mocked(isEntryReadonly).mockReturnValue(false);
    }
  });

  test('lists the cloud storage services once they have been listed', async () => {
    const { promise, resolve } = Promise.withResolvers();

    vi.mocked(getExternalMoveDestinations).mockReturnValue(promise);
    await render(MoveDialog);

    assetMoveRequest.current = { assets: [assets[0]] };

    const dialog = page.getByRole('dialog', { name: 'Move \u2068a.png\u2069' });

    await expect.element(dialog).toBeVisible();
    expect(getRootLabels()).toEqual(['Global Assets', 'Posts']);

    resolve([serviceRoot]);
    await expect.poll(getRootLabels).toEqual(['Global Assets', 'Posts', 'Test Cloud']);

    // A repository asset can be moved to any folder on a service
    await pick('Test Cloud');
    await expect.element(dialog.getByRole('alert')).toHaveTextContent('');
    await expect.element(dialog.getByRole('button', { name: 'Move' })).toBeEnabled();
  });

  test('lists the cloud storage services again for another request', async () => {
    vi.mocked(getExternalMoveDestinations).mockResolvedValue([serviceRoot]);
    await render(MoveDialog);

    assetMoveRequest.current = { assets: [assets[0]] };
    await expect.poll(getRootLabels).toEqual(['Global Assets', 'Posts', 'Test Cloud']);
    assetMoveRequest.current = undefined;

    // The folders on the service may have changed since, so the earlier listing isn’t shown
    const { promise, resolve } = Promise.withResolvers();

    vi.mocked(getExternalMoveDestinations).mockReturnValue(promise);
    assetMoveRequest.current = { assets: [assets[1]] };
    await expect
      .element(page.getByRole('dialog', { name: 'Move \u2068b.png\u2069' }))
      .toBeVisible();
    expect(getRootLabels()).toEqual(['Global Assets', 'Posts']);

    resolve([serviceRoot]);
    await expect.poll(getRootLabels).toEqual(['Global Assets', 'Posts', 'Test Cloud']);
  });

  test('opens with the cloud storage service the assets have been dropped on', async () => {
    const { promise, resolve } = Promise.withResolvers();

    vi.mocked(getExternalMoveDestinations).mockReturnValue(promise);
    vi.mocked(moveToDestination).mockResolvedValueOnce(undefined);
    vi.mocked(followMovedAssets).mockResolvedValueOnce(undefined);
    await render(MoveDialog);

    const request = { assets: [assets[0]], dirPath: '', serviceId: 'test_cloud' };

    assetMoveRequest.current = request;

    const dialog = page.getByRole('dialog', { name: 'Move \u2068a.png\u2069' });
    const button = dialog.getByRole('button', { name: 'Move' });

    // The service isn’t in the tree until it has been listed
    await expect.element(dialog).toBeVisible();
    await expect.element(button).toBeDisabled();

    resolve([serviceRoot]);
    await expect
      .element(dialog.getByRole('treeitem', { name: 'Test Cloud' }))
      .toHaveAttribute('aria-selected', 'true');
    await expect.element(button).toBeEnabled();
    await button.click();

    await vi.waitFor(() => expect(followMovedAssets).toHaveBeenCalledOnce());
    expect(moveToDestination).toHaveBeenCalledExactlyOnceWith(request, serviceRoot);
    expect(vi.mocked(moveToDestination).mock.calls[0][0]).toBe(request);
    expect(followMovedAssets).toHaveBeenCalledWith(request, serviceRoot);
    expect(moveAssets).not.toHaveBeenCalled();
    await waitForToastsToHide();
  });

  test('keeps the folder picked up front when the services are listed afterwards', async () => {
    const { promise, resolve } = Promise.withResolvers();

    vi.mocked(getExternalMoveDestinations).mockReturnValue(promise);
    await render(MoveDialog);

    assetMoveRequest.current = { assets: [assets[1]], dirPath: 'static/posts' };

    const dialog = page.getByRole('dialog', { name: 'Move \u2068b.png\u2069' });

    await expect
      .element(dialog.getByRole('treeitem', { name: 'Posts' }))
      .toHaveAttribute('aria-selected', 'true');

    resolve([serviceRoot]);
    await expect.poll(getRootLabels).toContain('Test Cloud');
    expect(getItem('Posts')).toHaveAttribute('aria-selected', 'true');
    expect(getItem('Test Cloud')).toHaveAttribute('aria-selected', 'false');
  });

  test('moves files on a cloud storage service to another folder on it', async () => {
    vi.mocked(getExternalMoveDestinations).mockResolvedValue([serviceRoot]);
    vi.mocked(moveToDestination).mockResolvedValueOnce(undefined);
    vi.mocked(followMovedAssets).mockResolvedValueOnce(undefined);
    await render(MoveDialog);

    const request = { externalAssets: [externalAsset], service };

    assetMoveRequest.current = request;

    const dialog = page.getByRole('dialog', { name: 'Move \u2068photo.png\u2069' });
    const button = dialog.getByRole('button', { name: 'Move' });

    await expect.element(dialog).toBeVisible();
    await expect.poll(getRootLabels).toEqual(['Global Assets', 'Posts', 'Test Cloud']);

    // The file’s own folder
    await pick('Test Cloud');
    await userEvent.keyboard('{ArrowRight}');
    await expect
      .element(dialog.getByRole('treeitem', { name: 'Test Cloud' }))
      .toHaveAttribute('aria-expanded', 'true');
    await pick('images');
    await expect
      .element(dialog.getByRole('alert'))
      .toHaveTextContent('The asset is already in this folder.');
    await expect.element(button).toBeDisabled();

    await pick('other');
    await expect.element(dialog.getByRole('alert')).toHaveTextContent('');
    await expect.element(button).toBeEnabled();
    await button.click();

    await vi.waitFor(() => expect(followMovedAssets).toHaveBeenCalledOnce());
    expect(moveToDestination).toHaveBeenCalledExactlyOnceWith(request, serviceOtherFolder);
    // The very service the files are on, which the move tells apart from another one by identity
    expect(vi.mocked(moveToDestination).mock.calls[0][0].service).toBe(service);
    expect(followMovedAssets).toHaveBeenCalledWith(request, serviceOtherFolder);
    await expect.poll(() => assetMoveRequest.current).toBeUndefined();
    await waitForToastsToHide();
  });

  test('moves several files on a cloud storage service to the repository', async () => {
    vi.mocked(moveToDestination).mockRejectedValueOnce(new Error('Upload failed'));
    await render(MoveDialog);

    assetMoveRequest.current = {
      externalAssets: [externalAsset, createMockExternalAsset({ fileName: 'other.png' })],
      service,
    };

    const dialog = page.getByRole('dialog', { name: 'Move 2 Assets' });

    await expect.element(dialog).toBeVisible();
    await pick('Posts');
    await dialog.getByRole('button', { name: 'Move' }).click();

    await vi.waitFor(() => expect(moveToDestination).toHaveBeenCalledOnce());
    await expect.poll(() => document.querySelector('[role="dialog"]')).toBeNull();
    expect(followMovedAssets).not.toHaveBeenCalled();
    await waitForToastsToHide();
  });
});
