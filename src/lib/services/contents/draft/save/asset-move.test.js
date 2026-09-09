// @ts-nocheck

import { beforeEach, describe, expect, test, vi } from 'vitest';

import { allAssets } from '$lib/services/assets';
import { getAssetFolder } from '$lib/services/assets/folders';
import { getAssetBlob } from '$lib/services/assets/info';
import { buildEntryAssetMoveChanges } from '$lib/services/contents/draft/save/asset-move';

vi.mock('$lib/services/assets', () => ({ allAssets: { subscribe: vi.fn() } }));

vi.mock('$lib/services/assets/folders', () => ({ getAssetFolder: vi.fn() }));

vi.mock('$lib/services/assets/info', () => ({ getAssetBlob: vi.fn() }));

vi.mock('svelte/store', async () => {
  const actual = await vi.importActual('svelte/store');

  return { ...actual, get: vi.fn() };
});

/** Page bundle collection: each entry owns the folder holding its index file. */
const collection = {
  name: 'pages',
  _type: 'entry',
  _file: { subPath: '{{slug}}/_index' },
  _i18n: { structure: 'single_file' },
};

/**
 * Create an entry with only the properties the builder reads.
 * @param {Record<string, string>} paths File path per locale.
 * @returns {any} Entry.
 */
const createEntry = (paths) => ({
  locales: Object.fromEntries(Object.entries(paths).map(([locale, path]) => [locale, { path }])),
});

/**
 * Create an asset with only the properties the builder reads.
 * @param {string} path Asset path.
 * @returns {any} Asset.
 */
const createAsset = (path) => ({
  path,
  name: path.slice(path.lastIndexOf('/') + 1),
  sha: `sha-${path}`,
});

/**
 * Make the builder see the given assets.
 * @param {any[]} assets Assets.
 */
const setAssets = async (assets) => {
  const { get } = await import('svelte/store');

  vi.mocked(get).mockImplementation((store) => (store === allAssets ? assets : undefined));
};

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(getAssetFolder).mockReturnValue({ entryRelative: true });
  vi.mocked(getAssetBlob).mockImplementation(async ({ path }) => new Blob([path]));
  await setAssets([]);
});

describe('buildEntryAssetMoveChanges()', () => {
  test('moves the assets stored in the entry’s folder', async () => {
    await setAssets([
      createAsset('content/pages/about/our-history/photo.jpg'),
      createAsset('content/pages/about/our-history/images/logo.svg'),
      createAsset('content/pages/about/sibling.jpg'),
    ]);

    const { changes, savingAssets } = await buildEntryAssetMoveChanges({
      collection,
      originalEntry: createEntry({ _default: 'content/pages/about/our-history/_index.md' }),
      savingEntry: createEntry({ _default: 'content/pages/guides/our-history/_index.md' }),
      changes: [],
    });

    expect(changes).toEqual([
      {
        action: 'move',
        path: 'content/pages/guides/our-history/photo.jpg',
        previousPath: 'content/pages/about/our-history/photo.jpg',
        previousSha: 'sha-content/pages/about/our-history/photo.jpg',
        data: expect.any(File),
      },
      {
        action: 'move',
        path: 'content/pages/guides/our-history/images/logo.svg',
        previousPath: 'content/pages/about/our-history/images/logo.svg',
        previousSha: 'sha-content/pages/about/our-history/images/logo.svg',
        data: expect.any(File),
      },
    ]);

    expect(savingAssets.map(({ path }) => path)).toEqual([
      'content/pages/guides/our-history/photo.jpg',
      'content/pages/guides/our-history/images/logo.svg',
    ]);
  });

  test('takes the assets of a descendant entry along', async () => {
    await setAssets([createAsset('content/pages/about/team/portrait.jpg')]);

    const { changes } = await buildEntryAssetMoveChanges({
      collection,
      originalEntry: createEntry({ _default: 'content/pages/about/_index.md' }),
      savingEntry: createEntry({ _default: 'content/pages/guides/about/_index.md' }),
      changes: [],
    });

    expect(changes.map(({ path }) => path)).toEqual([
      'content/pages/guides/about/team/portrait.jpg',
    ]);
  });

  test('reuses the blob already attached to the asset', async () => {
    const asset = { ...createAsset('content/pages/about/photo.jpg'), file: new File([], 'x') };

    await setAssets([asset]);

    await buildEntryAssetMoveChanges({
      collection,
      originalEntry: createEntry({ _default: 'content/pages/about/_index.md' }),
      savingEntry: createEntry({ _default: 'content/pages/guides/_index.md' }),
      changes: [],
    });

    expect(getAssetBlob).not.toHaveBeenCalled();
  });

  test('drops an asset the save is already writing to the destination', async () => {
    await setAssets([createAsset('content/pages/about/photo.jpg')]);

    const { changes, savingAssets } = await buildEntryAssetMoveChanges({
      collection,
      originalEntry: createEntry({ _default: 'content/pages/about/_index.md' }),
      savingEntry: createEntry({ _default: 'content/pages/guides/_index.md' }),
      changes: [{ action: 'update', path: 'content/pages/guides/photo.jpg' }],
    });

    expect(changes).toEqual([
      {
        action: 'delete',
        path: 'content/pages/about/photo.jpg',
        previousSha: 'sha-content/pages/about/photo.jpg',
      },
    ]);

    expect(savingAssets).toEqual([]);
  });

  test('moves each locale’s folder with a multi-folder i18n structure', async () => {
    await setAssets([
      createAsset('content/pages/en/about/photo.jpg'),
      createAsset('content/pages/fr/about/photo.jpg'),
    ]);

    const { changes } = await buildEntryAssetMoveChanges({
      collection: { ...collection, _i18n: { structure: 'multiple_folders' } },
      originalEntry: createEntry({
        en: 'content/pages/en/about/_index.md',
        fr: 'content/pages/fr/about/_index.md',
      }),
      savingEntry: createEntry({
        en: 'content/pages/en/guides/about/_index.md',
        fr: 'content/pages/fr/guides/about/_index.md',
      }),
      changes: [],
    });

    expect(changes.map(({ path }) => path).sort()).toEqual([
      'content/pages/en/guides/about/photo.jpg',
      'content/pages/fr/guides/about/photo.jpg',
    ]);
  });

  test('ignores a locale that the entry didn’t have before', async () => {
    await setAssets([createAsset('content/pages/en/about/photo.jpg')]);

    const { changes } = await buildEntryAssetMoveChanges({
      collection: { ...collection, _i18n: { structure: 'multiple_folders' } },
      originalEntry: createEntry({ en: 'content/pages/en/about/_index.md' }),
      savingEntry: createEntry({
        en: 'content/pages/en/about/_index.md',
        fr: 'content/pages/fr/guides/_index.md',
      }),
      changes: [],
    });

    expect(changes).toEqual([]);
  });

  test('moves the assets of a nested entry that has no `path` option', async () => {
    await setAssets([createAsset('content/pages/about/photo.jpg')]);

    const { changes } = await buildEntryAssetMoveChanges({
      collection: {
        ...collection,
        folder: 'content/pages',
        nested: { subfolders: true },
        meta: { path: { index_file: '_index' } },
        _file: { subPath: undefined },
      },
      originalEntry: createEntry({ _default: 'content/pages/about/_index.md' }),
      savingEntry: createEntry({ _default: 'content/pages/guides/about/_index.md' }),
      changes: [],
    });

    expect(changes.map(({ path }) => path)).toEqual(['content/pages/guides/about/photo.jpg']);
  });

  test('skips a new entry', async () => {
    await setAssets([createAsset('content/pages/about/photo.jpg')]);

    expect(
      await buildEntryAssetMoveChanges({
        collection,
        originalEntry: undefined,
        savingEntry: createEntry({ _default: 'content/pages/guides/_index.md' }),
        changes: [],
      }),
    ).toEqual({ changes: [], savingAssets: [] });
  });

  test('skips a collection whose assets aren’t stored at a relative path', async () => {
    vi.mocked(getAssetFolder).mockReturnValue({ entryRelative: false });
    await setAssets([createAsset('content/pages/about/photo.jpg')]);

    expect(
      (
        await buildEntryAssetMoveChanges({
          collection,
          originalEntry: createEntry({ _default: 'content/pages/about/_index.md' }),
          savingEntry: createEntry({ _default: 'content/pages/guides/_index.md' }),
          changes: [],
        })
      ).changes,
    ).toEqual([]);
  });

  test('skips a collection where each entry is a plain file', async () => {
    await setAssets([createAsset('content/pages/about/photo.jpg')]);

    expect(
      (
        await buildEntryAssetMoveChanges({
          collection: { ...collection, _file: { subPath: undefined } },
          originalEntry: createEntry({ _default: 'content/pages/about.md' }),
          savingEntry: createEntry({ _default: 'content/pages/guides.md' }),
          changes: [],
        })
      ).changes,
    ).toEqual([]);
  });

  test('skips a file collection', async () => {
    await setAssets([createAsset('content/pages/about/photo.jpg')]);

    expect(
      (
        await buildEntryAssetMoveChanges({
          collection: { ...collection, _type: 'file' },
          fileName: 'about',
          originalEntry: createEntry({ _default: 'content/pages/about/_index.md' }),
          savingEntry: createEntry({ _default: 'content/pages/guides/_index.md' }),
          changes: [],
        })
      ).changes,
    ).toEqual([]);
  });

  test('skips an entry that stayed where it was', async () => {
    await setAssets([createAsset('content/pages/about/photo.jpg')]);

    expect(
      (
        await buildEntryAssetMoveChanges({
          collection,
          originalEntry: createEntry({ _default: 'content/pages/about/_index.md' }),
          savingEntry: createEntry({ _default: 'content/pages/about/_index.md' }),
          changes: [],
        })
      ).changes,
    ).toEqual([]);
  });
});
