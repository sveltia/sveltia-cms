import { describe, expect, test, vi } from 'vitest';

import { isCollectionIndexFile } from '$lib/services/contents/collection/entries/index-file';
import { getCollectionFilesByEntry } from '$lib/services/contents/collection/files';
import { getAssociatedCollections } from '$lib/services/contents/entry/collections';
import { getEntryCollectionContexts } from '$lib/services/contents/entry/contexts';

vi.mock('$lib/services/contents/collection/entries/index-file', () => ({
  isCollectionIndexFile: vi.fn(() => false),
}));
vi.mock('$lib/services/contents/collection/files', () => ({
  getCollectionFilesByEntry: vi.fn(() => []),
}));
vi.mock('$lib/services/contents/entry/collections', () => ({
  getAssociatedCollections: vi.fn(() => []),
}));

const entry = /** @type {any} */ ({ slug: 'about', locales: {} });

describe('getEntryCollectionContexts()', () => {
  test('gives one context per collection, or per collection file', () => {
    const posts = /** @type {any} */ ({ name: 'posts' });
    const pages = /** @type {any} */ ({ name: 'pages' });
    const about = /** @type {any} */ ({ name: 'about' });
    const team = /** @type {any} */ ({ name: 'team' });

    vi.mocked(getAssociatedCollections).mockReturnValue([posts, pages]);
    vi.mocked(getCollectionFilesByEntry).mockImplementation((collection) =>
      collection === pages ? [about, team] : [],
    );
    vi.mocked(isCollectionIndexFile).mockImplementation((collection) => collection === posts);

    expect(getEntryCollectionContexts(entry).toArray()).toEqual([
      { collection: posts, isIndexFile: true },
      { collection: pages, collectionFile: about, isIndexFile: false },
      { collection: pages, collectionFile: team, isIndexFile: false },
    ]);
  });

  test('looks up the files of a collection only once its contexts are reached', () => {
    const posts = /** @type {any} */ ({ name: 'posts' });
    const pages = /** @type {any} */ ({ name: 'pages' });

    vi.mocked(getAssociatedCollections).mockReturnValue([posts, pages]);
    vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);

    expect(
      getEntryCollectionContexts(entry).find(({ collection }) => collection === posts),
    ).toEqual({ collection: posts, isIndexFile: false });
    expect(getCollectionFilesByEntry).toHaveBeenCalledOnce();
  });

  test('gives nothing for an entry in no collection', () => {
    vi.mocked(getAssociatedCollections).mockReturnValue([]);
    expect(getEntryCollectionContexts(entry).toArray()).toEqual([]);
  });
});
