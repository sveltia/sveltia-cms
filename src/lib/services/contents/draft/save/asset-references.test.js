// @ts-nocheck
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getExistingEntryAssetFolderPath } from '$lib/services/assets/entry-folder';
import { getAssetFolder } from '$lib/services/assets/folders';
import { getAssetPublicURL } from '$lib/services/assets/info';
import { getEntriesByAssets } from '$lib/services/assets/references';
import { allAssets } from '$lib/services/assets/state';
import { rewriteEntryAssetReferences } from '$lib/services/contents/draft/save/asset-references';

vi.mock('$lib/services/assets/entry-folder', () => ({
  getExistingEntryAssetFolderPath: vi.fn(),
}));

vi.mock('$lib/services/assets/folders', () => ({ getAssetFolder: vi.fn() }));

vi.mock('$lib/services/assets/info', () => ({ getAssetPublicURL: vi.fn() }));

vi.mock('$lib/services/assets/references', () => ({ getEntriesByAssets: vi.fn() }));

vi.mock('$lib/services/assets/state', () => ({ allAssets: { current: [] } }));

vi.mock('$lib/services/contents/draft/save/asset-move', async (importOriginal) => ({
  ...(await importOriginal()),
  getMovedFolders: vi.fn(() => new Map([['content/posts/hello', 'content/posts/bye']])),
}));

/** Collection keeping each entry’s images beside it. */
const collection = { name: 'posts', _type: 'entry', _i18n: { defaultLocale: 'en' } };
/**
 * Create an entry with the given locale files.
 * @param {string} slug Slug.
 * @param {Record<string, any>} locales Locale files.
 * @returns {any} Entry.
 */
const createEntry = (slug, locales) => ({ id: 'post', slug, locales });
/**
 * Create an asset.
 * @param {string} path Asset path.
 * @returns {any} Asset.
 */
const createAsset = (path) => ({ path, name: path.split('/').pop() });

const originalEntry = createEntry('hello', {
  en: { path: 'content/posts/hello/index.md', content: { cover: '/blog/hello/a.png' } },
});

const savingEntry = createEntry('bye', {
  en: { path: 'content/posts/bye/index.md', content: { cover: '/blog/hello/a.png' } },
});

beforeEach(() => {
  vi.mocked(getAssetFolder).mockReturnValue({
    entryRelative: true,
    publicPath: '/blog/{{slug}}/images',
  });
  vi.mocked(getExistingEntryAssetFolderPath).mockReturnValue('content/posts/hello');
  // The URL is made of the entry’s slug and the asset’s file name
  vi.mocked(getAssetPublicURL).mockImplementation(
    (asset, { entry }) => `/blog/${entry.slug}/${asset.name}`,
  );
  vi.mocked(getEntriesByAssets).mockImplementation(async (targets, { entries }) => {
    entries.forEach(({ locales }) => {
      Object.values(locales).forEach(({ content }) => {
        targets.forEach(({ url, newURL }) => {
          if (content.cover === url) {
            content.cover = newURL;
          }
        });
      });
    });

    return [];
  });
  allAssets.current = [createAsset('content/posts/hello/a.png')];
});

describe('rewriteEntryAssetReferences()', () => {
  test('rewrites the references to the entry’s assets moved along with it', async () => {
    const result = await rewriteEntryAssetReferences({ collection, originalEntry, savingEntry });

    expect(result.locales.en.content).toEqual({ cover: '/blog/bye/a.png' });
    expect(savingEntry.locales.en.content).toEqual({ cover: '/blog/hello/a.png' });
    expect(getAssetPublicURL).toHaveBeenLastCalledWith(
      { path: 'content/posts/bye/a.png', name: 'a.png' },
      { pathOnly: true, entry: savingEntry, locale: 'en' },
    );
  });

  test('looks up the folder of a collection file', async () => {
    const collectionFile = { name: 'about', _i18n: { defaultLocale: 'en' } };

    await rewriteEntryAssetReferences({
      collection,
      collectionFile,
      isIndexFile: false,
      originalEntry,
      savingEntry,
    });

    expect(getAssetFolder).toHaveBeenCalledWith({
      collectionName: 'posts',
      fileName: 'about',
      isIndexFile: false,
    });
  });

  test.each([
    ['a new entry', { originalEntry: undefined }],
    ['no asset folder', { folder: undefined }],
    ['a folder that isn’t entry-relative', { folder: { publicPath: '/blog/{{slug}}' } }],
    ['a folder without a public path', { folder: { entryRelative: true } }],
    ['a relative public path', { folder: { entryRelative: true, publicPath: '{{slug}}' } }],
    ['a public path without tags', { folder: { entryRelative: true, publicPath: '/images' } }],
  ])('leaves the entry as is for %s', async (_name, { folder, ...args }) => {
    if (!('originalEntry' in args)) {
      vi.mocked(getAssetFolder).mockReturnValue(folder);
    }

    expect(
      await rewriteEntryAssetReferences({ collection, originalEntry, savingEntry, ...args }),
    ).toBe(savingEntry);
    expect(getEntriesByAssets).not.toHaveBeenCalled();
  });

  test('leaves an asset outside the entry’s folder alone', async () => {
    allAssets.current = [createAsset('content/posts/world/a.png')];

    expect(await rewriteEntryAssetReferences({ collection, originalEntry, savingEntry })).toBe(
      savingEntry,
    );
  });

  test('looks at every asset for an entry at the repository root', async () => {
    vi.mocked(getExistingEntryAssetFolderPath).mockReturnValue('');
    allAssets.current = [createAsset('a.png')];

    const result = await rewriteEntryAssetReferences({ collection, originalEntry, savingEntry });

    expect(result.locales.en.content).toEqual({ cover: '/blog/bye/a.png' });
  });

  test('leaves an asset whose reference is relative or can’t be worked out alone', async () => {
    vi.mocked(getAssetPublicURL)
      .mockReturnValueOnce('images/a.png')
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce('/blog/hello/b.png')
      .mockReturnValueOnce(undefined);
    allAssets.current = [
      createAsset('content/posts/hello/a.png'),
      createAsset('content/posts/hello/a2.png'),
      createAsset('content/posts/hello/b.png'),
    ];

    expect(await rewriteEntryAssetReferences({ collection, originalEntry, savingEntry })).toBe(
      savingEntry,
    );
  });

  test('also rewrites the default locale’s references in another locale', async () => {
    const original = createEntry('hello', {
      en: originalEntry.locales.en,
      // A locale turned on in this save has no references of its own yet
    });

    const saving = createEntry('bye', {
      en: savingEntry.locales.en,
      fr: { path: 'content/posts/bye/index.fr.md', content: { cover: '/blog/hello/a.png' } },
    });

    const result = await rewriteEntryAssetReferences({
      collection,
      originalEntry: original,
      savingEntry: saving,
    });

    expect(result.locales.fr.content).toEqual({ cover: '/blog/bye/a.png' });
    // The targets of each locale are worked out once
    expect(getExistingEntryAssetFolderPath).toHaveBeenCalledOnce();
    expect(getEntriesByAssets).toHaveBeenLastCalledWith(
      [{ url: '/blog/hello/a.png', newURL: '/blog/bye/a.png' }],
      {
        entries: [
          {
            ...saving,
            locales: { fr: { ...saving.locales.fr, content: { cover: '/blog/bye/a.png' } } },
          },
        ],
      },
    );
  });
});
