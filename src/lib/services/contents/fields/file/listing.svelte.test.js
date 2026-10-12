// @vitest-environment happy-dom

import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { getTargetFolderPath, listAssets } from '$lib/services/contents/fields/file/helpers';
import { getUnsavedAssets } from '$lib/services/contents/fields/file/process';
import { createRawState } from '$lib/services/utils/state.svelte';

import { createFolderAssetListing } from './listing.svelte.js';

/**
 * @import { Asset, AssetFolderInfo, EntryDraft } from '$lib/types/private';
 */

vi.mock('$lib/services/contents/fields/file/helpers', () => ({
  getTargetFolderPath: vi.fn(),
  listAssets: vi.fn(),
}));

vi.mock('$lib/services/contents/fields/file/process', () => ({
  getUnsavedAssets: vi.fn(),
}));

/**
 * Wait for the effects to run and the promises to settle.
 * @returns {Promise<void>} Promise.
 */
const wait = () =>
  new Promise((resolve) => {
    setTimeout(resolve);
  });

const folder = /** @type {AssetFolderInfo} */ ({ internalPath: 'static/images' });
const draft = /** @type {EntryDraft} */ (/** @type {unknown} */ ({ originalEntry: { slug: 'a' } }));
const savedAsset = /** @type {Asset} */ ({ name: 'saved.png' });
const unsavedAsset = /** @type {Asset} */ ({ name: 'unsaved.png', unsaved: true });
const droppedFile = new File([''], 'dropped.png');
const droppedAsset = /** @type {Asset} */ ({ name: 'dropped.png', file: droppedFile });
/** @type {(() => void) | undefined} */
let stop;

beforeEach(() => {
  vi.mocked(getTargetFolderPath).mockReturnValue('static/images');
  vi.mocked(listAssets).mockImplementation(({ unsavedAssets }) => [...unsavedAssets, savedAsset]);
  vi.mocked(getUnsavedAssets).mockResolvedValue([unsavedAsset]);
});

afterEach(() => {
  stop?.();
  stop = undefined;
});

describe('createFolderAssetListing()', () => {
  test('lists the folder’s assets along with the draft’s unsaved files', async () => {
    /** @type {ReturnType<typeof createFolderAssetListing>} */
    let listing = /** @type {any} */ (undefined);

    stop = $effect.root(() => {
      listing = createFolderAssetListing({
        getDraft: vi.fn(() => draft),
        getFolder: vi.fn(() => folder),
        getLocale: vi.fn(() => 'en'),
        getKind: vi.fn(() => /** @type {'image'} */ ('image')),
        getAccept: vi.fn(() => 'image/*'),
        getSlugificationEnabled: vi.fn(() => true),
      });
    });

    await wait();

    expect(listing.targetFolderPath).toBe('static/images');
    expect(getTargetFolderPath).toHaveBeenCalledWith({
      entry: draft.originalEntry,
      folder,
      locale: 'en',
    });
    expect(getUnsavedAssets).toHaveBeenCalledWith({ draft, targetFolderPath: 'static/images' });
    expect(listing.unsavedAssets).toEqual([unsavedAsset]);
    expect(listing.listedAssets).toEqual([unsavedAsset, savedAsset]);
    expect(listAssets).toHaveBeenLastCalledWith({
      kind: 'image',
      accept: 'image/*',
      folder,
      folderPath: 'static/images',
      unsavedAssets: [unsavedAsset],
      uncheckedFiles: [],
      slugificationEnabled: true,
    });

    listing.reset();
    expect(listing.unsavedAssets).toEqual([]);
  });

  test('adds the dropped assets, which are listed whatever their type', async () => {
    const dropped = /** @type {{ current: Asset[] }} */ (createRawState([]));
    /** @type {ReturnType<typeof createFolderAssetListing>} */
    let listing = /** @type {any} */ (undefined);

    stop = $effect.root(() => {
      listing = createFolderAssetListing({
        getDraft: vi.fn(() => undefined),
        getFolder: vi.fn(() => folder),
        getLocale: vi.fn(() => undefined),
        getKind: vi.fn(() => undefined),
        getAccept: vi.fn(() => undefined),
        getSlugificationEnabled: vi.fn(() => false),
        getDroppedAssets: vi.fn(() => dropped.current),
      });
    });

    await wait();

    // Without a draft, there are no unsaved files to read
    expect(getUnsavedAssets).not.toHaveBeenCalled();
    expect(listing.unsavedAssets).toEqual([]);

    dropped.current = [droppedAsset];
    flushSync();
    await wait();

    expect(listing.unsavedAssets).toEqual([droppedAsset]);
    expect(listing.listedAssets).toEqual([droppedAsset, savedAsset]);
    expect(listAssets).toHaveBeenLastCalledWith(
      expect.objectContaining({ uncheckedFiles: [droppedFile] }),
    );
  });
});
