import { IndexedDB } from '@sveltia/utils/storage';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { listTrees, TREE_CACHE_STORE_NAME } from '$lib/services/backends/git/shared/tree-cache';
/**
 * @import { TreeListing } from '$lib/services/backends/git/shared/tree-cache';
 */

vi.mock('@sveltia/utils/storage');

const repository = { databaseName: 'gitlab:owner/repo' };
/** @type {Map<string, TreeListing>} */
let stored;

const db = {
  entries: vi.fn(async () => [...stored]),
  saveEntries: vi.fn(async (/** @type {[string, TreeListing][]} */ records) => {
    records.forEach(([key, value]) => stored.set(key, value));
  }),
  deleteEntries: vi.fn(async (/** @type {string[]} */ keys) => {
    keys.forEach((key) => stored.delete(key));
  }),
};

/**
 * A repository with a gallery of two albums, keyed with directory paths.
 * @type {Record<string, TreeListing>}
 */
const TREES = {
  gallery: {
    trees: [
      ['one', 'tree-one'],
      ['two', 'tree-two'],
    ],
    blobs: [['_index.md', 'blob-index']],
  },
  'gallery/one': { trees: [], blobs: [['a.jpg', 'blob-a']] },
  'gallery/two': { trees: [], blobs: [['b.jpg', 'blob-b']] },
};

const fetchTreeListing = vi.fn(async (/** @type {string} */ path) => TREES[path]);

/**
 * List the gallery.
 * @param {Partial<Parameters<typeof listTrees>[0]>} [args] Arguments to override.
 * @returns {ReturnType<typeof listTrees>} Files.
 */
const listGallery = (args) =>
  listTrees({
    repository,
    roots: [{ path: 'gallery', sha: 'tree-gallery' }],
    fetchTreeListing,
    cacheable: true,
    ...args,
  });

const GALLERY_FILES = [
  { type: 'blob', path: 'gallery/_index.md', sha: 'blob-index' },
  { type: 'blob', path: 'gallery/one/a.jpg', sha: 'blob-a' },
  { type: 'blob', path: 'gallery/two/b.jpg', sha: 'blob-b' },
];

describe('listTrees()', () => {
  beforeEach(() => {
    stored = new Map();

    /**
     * Mock of the database wrapper, backed by the shared mock database.
     */
    class MockIndexedDB {
      /**
       * Create an instance backed by the shared mock database.
       */
      constructor() {
        Object.assign(this, db);
      }
    }

    vi.mocked(IndexedDB).mockImplementation(/** @type {any} */ (MockIndexedDB));
  });

  test('lists every directory on a cold load, and caches the listings', async () => {
    await expect(listGallery()).resolves.toEqual(GALLERY_FILES);
    expect(IndexedDB).toHaveBeenCalledWith('gitlab:owner/repo', TREE_CACHE_STORE_NAME);
    expect(fetchTreeListing.mock.calls).toEqual([['gallery'], ['gallery/one'], ['gallery/two']]);
    expect([...stored.keys()]).toEqual(['tree-gallery', 'tree-one', 'tree-two']);
    expect(db.deleteEntries).not.toHaveBeenCalled();
  });

  test('takes everything from the cache when nothing has changed', async () => {
    await listGallery();
    fetchTreeListing.mockClear();
    db.saveEntries.mockClear();

    await expect(listGallery()).resolves.toEqual(GALLERY_FILES);
    expect(fetchTreeListing).not.toHaveBeenCalled();
    expect(db.saveEntries).not.toHaveBeenCalled();
  });

  test('lists only the directories that have changed, and prunes the old ones', async () => {
    await listGallery();
    fetchTreeListing.mockClear();
    fetchTreeListing
      .mockResolvedValueOnce({
        trees: [
          ['one', 'tree-one'],
          ['two', 'tree-two-new'],
        ],
        blobs: [['_index.md', 'blob-index']],
      })
      .mockResolvedValueOnce({ trees: [], blobs: [['c.jpg', 'blob-c']] });

    await expect(
      listGallery({ roots: [{ path: 'gallery', sha: 'tree-gallery-new' }] }),
    ).resolves.toEqual([
      { type: 'blob', path: 'gallery/_index.md', sha: 'blob-index' },
      { type: 'blob', path: 'gallery/one/a.jpg', sha: 'blob-a' },
      { type: 'blob', path: 'gallery/two/c.jpg', sha: 'blob-c' },
    ]);
    expect(fetchTreeListing.mock.calls).toEqual([['gallery'], ['gallery/two']]);
    expect([...stored.keys()].sort()).toEqual(['tree-gallery-new', 'tree-one', 'tree-two-new']);
  });

  test('lists the same tree only once, and a directory without a tree ID every time', async () => {
    fetchTreeListing.mockResolvedValueOnce({
      trees: [
        ['one', 'tree-same'],
        ['two', 'tree-same'],
      ],
      blobs: [],
    });
    fetchTreeListing.mockResolvedValueOnce({ trees: [], blobs: [['a.jpg', 'blob-a']] });

    await expect(listGallery({ roots: [{ path: '' }] })).resolves.toEqual([
      { type: 'blob', path: 'one/a.jpg', sha: 'blob-a' },
      { type: 'blob', path: 'two/a.jpg', sha: 'blob-a' },
    ]);
    expect(fetchTreeListing.mock.calls).toEqual([[''], ['one']]);
    expect([...stored.keys()]).toEqual(['tree-same']);
  });

  test('doesn’t cache an empty listing, which is a directory that couldn’t be found', async () => {
    fetchTreeListing.mockResolvedValueOnce({ trees: [], blobs: [] });

    await expect(listGallery()).resolves.toEqual([]);
    expect(stored.size).toBe(0);
  });

  test('doesn’t cache what isn’t cacheable, but still reads the cache', async () => {
    stored.set('tree-one', TREES['gallery/one']);

    await expect(listGallery({ cacheable: false })).resolves.toEqual(GALLERY_FILES);
    expect(fetchTreeListing.mock.calls).toEqual([['gallery'], ['gallery/two']]);
    expect([...stored.keys()]).toEqual(['tree-one']);
    expect(db.saveEntries).not.toHaveBeenCalled();
  });

  test('keeps what was listed when the walk fails, without pruning', async () => {
    stored.set('tree-old', TREES['gallery/one']);
    fetchTreeListing
      .mockResolvedValueOnce(TREES.gallery)
      .mockResolvedValueOnce(TREES['gallery/one'])
      .mockRejectedValueOnce(new Error('Network error'));

    await expect(listGallery()).rejects.toThrow('Network error');
    expect([...stored.keys()].sort()).toEqual(['tree-gallery', 'tree-old', 'tree-one']);
    expect(db.deleteEntries).not.toHaveBeenCalled();
  });

  test('works without the database', async () => {
    db.entries.mockRejectedValueOnce(new Error('Unavailable'));
    db.saveEntries.mockRejectedValueOnce(new Error('Unavailable'));

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(listGallery()).resolves.toEqual(GALLERY_FILES);
    expect(consoleError).toHaveBeenCalledWith(
      'Failed to update the tree cache.',
      expect.any(Error),
    );

    vi.mocked(IndexedDB).mockClear();
    await expect(listGallery({ repository: {} })).resolves.toEqual(GALLERY_FILES);
    expect(IndexedDB).not.toHaveBeenCalled();
  });
});
