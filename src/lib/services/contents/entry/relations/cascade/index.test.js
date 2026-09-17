// @ts-nocheck

import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  buildTargetChanges,
  getCandidateEntries,
} from '$lib/services/contents/entry/relations/cascade';

vi.mock('$lib/services/contents/collection/entries', () => ({
  getEntriesByCollection: vi.fn(() => []),
}));

vi.mock('$lib/services/contents/collection/entries/index-file', () => ({
  isCollectionIndexFile: vi.fn(() => false),
}));

vi.mock('$lib/services/contents/entry/changes', () => ({
  buildEntryUpdateChanges: vi.fn(async ({ entry }) => [
    { action: 'update', slug: entry.slug, path: `content/posts/${entry.slug}.md`, data: '' },
  ]),
  createSyntheticDraft: vi.fn((args) => ({ synthetic: true, ...args })),
  resolveCacheDB: vi.fn(() => undefined),
}));

const { getEntriesByCollection } = await import('$lib/services/contents/collection/entries');

const { isCollectionIndexFile } =
  await import('$lib/services/contents/collection/entries/index-file');

const { buildEntryUpdateChanges, createSyntheticDraft, resolveCacheDB } =
  await import('$lib/services/contents/entry/changes');

const postsCollection = { name: 'posts', _type: 'entry' };

/**
 * Create a blog post entry.
 * @param {string} id Entry ID and slug.
 * @returns {object} Entry.
 */
const createPost = (id) => ({
  id,
  slug: id,
  subPath: id,
  locales: { _default: { slug: id, path: `content/posts/${id}.md`, content: {} } },
});

beforeEach(() => {
  vi.clearAllMocks();
  isCollectionIndexFile.mockReturnValue(false);
});

describe('getCandidateEntries()', () => {
  test('returns the entries of the source collection', () => {
    const entries = [createPost('a'), createPost('b')];

    getEntriesByCollection.mockReturnValue(entries);

    expect(
      getCandidateEntries({
        relation: { sourceCollection: postsCollection },
        excludeIds: new Set(),
      }),
    ).toEqual(entries);
    expect(getEntriesByCollection).toHaveBeenCalledWith('posts');
  });

  test('leaves out the excluded entries', () => {
    getEntriesByCollection.mockReturnValue([createPost('a'), createPost('b'), createPost('c')]);

    expect(
      getCandidateEntries({
        relation: { sourceCollection: postsCollection },
        excludeIds: new Set(['a', 'c']),
      }).map(({ id }) => id),
    ).toEqual(['b']);
  });

  test('only returns the field’s own file in a file collection', () => {
    getEntriesByCollection.mockReturnValue([createPost('general'), createPost('other')]);

    expect(
      getCandidateEntries({
        relation: {
          sourceCollection: { name: 'config', _type: 'file' },
          sourceCollectionFile: { name: 'general' },
        },
        excludeIds: new Set(),
      }).map(({ id }) => id),
    ).toEqual(['general']);
  });
});

describe('buildTargetChanges()', () => {
  test('does nothing without targets', async () => {
    expect(await buildTargetChanges({ targets: [] })).toEqual({ changes: [], savingEntries: [] });
    expect(resolveCacheDB).not.toHaveBeenCalled();
  });

  test('builds an update change per target', async () => {
    const targets = [
      { entry: createPost('a'), collection: postsCollection },
      { entry: createPost('b'), collection: postsCollection },
    ];

    const { changes, savingEntries } = await buildTargetChanges({ targets });

    expect(changes.map(({ path }) => path)).toEqual(['content/posts/a.md', 'content/posts/b.md']);
    expect(savingEntries).toEqual(targets.map(({ entry }) => entry));
    expect(createSyntheticDraft).toHaveBeenCalledWith({
      collection: postsCollection,
      collectionFile: undefined,
      isIndexFile: false,
    });
  });

  test('passes the collection file along', async () => {
    const collection = { name: 'config', _type: 'file' };
    const collectionFile = { name: 'general' };

    await buildTargetChanges({
      targets: [{ entry: createPost('general'), collection, collectionFile }],
    });

    expect(buildEntryUpdateChanges).toHaveBeenCalledWith(
      expect.objectContaining({ collection, collectionFile }),
    );
    expect(createSyntheticDraft).toHaveBeenCalledWith(
      expect.objectContaining({ collection, collectionFile }),
    );
  });

  test('marks the index file so its fields resolve correctly', async () => {
    isCollectionIndexFile.mockReturnValue(true);

    await buildTargetChanges({
      targets: [{ entry: createPost('_index'), collection: postsCollection }],
    });

    expect(createSyntheticDraft).toHaveBeenCalledWith(
      expect.objectContaining({ isIndexFile: true }),
    );
  });

  test('reuses the caller’s file cache database', async () => {
    const cacheDB = { get: vi.fn() };

    resolveCacheDB.mockReturnValue(cacheDB);

    await buildTargetChanges({
      targets: [{ entry: createPost('a'), collection: postsCollection }],
      cacheDB,
    });

    expect(resolveCacheDB).toHaveBeenCalledWith(cacheDB);
    expect(buildEntryUpdateChanges).toHaveBeenCalledWith(expect.objectContaining({ cacheDB }));
  });
});
