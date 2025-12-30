import { get, writable } from 'svelte/store';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { deleteEntries, updateStores } from './delete';

// Mock dependencies
vi.mock('$lib/services/assets', () => ({
  allAssets: writable([]),
}));

vi.mock('$lib/services/backends/save', () => ({
  saveChanges: vi.fn(),
}));

vi.mock('$lib/services/contents', () => ({
  allEntries: writable([]),
}));

vi.mock('$lib/services/contents/collection', () => ({
  selectedCollection: writable(null),
}));

vi.mock('$lib/services/contents/collection/data', () => ({
  contentUpdatesToast: writable(null),
  UPDATE_TOAST_DEFAULT_STATE: {
    count: 0,
    created: false,
    deleted: false,
    updated: false,
  },
}));

vi.mock('$lib/services/backends', () => ({
  backend: writable(null),
}));

vi.mock('@sveltia/utils/storage', () => ({
  IndexedDB: vi.fn(),
}));

vi.mock('$lib/services/contents/draft/save/changes', () => ({
  getPreviousSha: vi.fn().mockResolvedValue('mock-sha-123'),
}));

describe('Test updateStores()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('removes entries from allEntries store', async () => {
    const { allEntries } = await import('$lib/services/contents');

    const mockEntries = [
      { id: '1', slug: 'post-1', locales: { en: { title: 'Post 1' } } },
      { id: '2', slug: 'post-2', locales: { en: { title: 'Post 2' } } },
      { id: '3', slug: 'post-3', locales: { en: { title: 'Post 3' } } },
    ];

    allEntries.set(/** @type {any} */ (mockEntries));

    updateStores({ ids: ['1', '3'], assetPaths: [] });

    const updatedEntries = get(allEntries);

    expect(updatedEntries).toEqual([
      { id: '2', slug: 'post-2', locales: { en: { title: 'Post 2' } } },
    ]);
  });

  test('updates contentUpdatesToast with deletion count', async () => {
    const { contentUpdatesToast, UPDATE_TOAST_DEFAULT_STATE } =
      await import('$lib/services/contents/collection/data');

    updateStores({ ids: ['1', '2', '3'], assetPaths: [] });

    expect(get(contentUpdatesToast)).toEqual({
      ...UPDATE_TOAST_DEFAULT_STATE,
      deleted: true,
      count: 3,
    });
  });

  test('removes assets from allAssets store when asset paths provided', async () => {
    const { allAssets } = await import('$lib/services/assets');

    const mockAssets = [
      { path: '/images/image1.jpg', name: 'image1.jpg' },
      { path: '/images/image2.jpg', name: 'image2.jpg' },
      { path: '/images/image3.jpg', name: 'image3.jpg' },
    ];

    allAssets.set(/** @type {any} */ (mockAssets));

    updateStores({ ids: ['1'], assetPaths: ['/images/image1.jpg', '/images/image3.jpg'] });

    const updatedAssets = get(allAssets);

    expect(updatedAssets).toEqual([{ path: '/images/image2.jpg', name: 'image2.jpg' }]);
  });

  test('handles empty arrays gracefully', async () => {
    const { allEntries } = await import('$lib/services/contents');
    const { allAssets } = await import('$lib/services/assets');
    const { contentUpdatesToast } = await import('$lib/services/contents/collection/data');
    const initialEntries = [{ id: '1', slug: 'post-1' }];
    const initialAssets = [{ path: '/image.jpg' }];

    allEntries.set(/** @type {any} */ (initialEntries));
    allAssets.set(/** @type {any} */ (initialAssets));

    updateStores({ ids: [], assetPaths: [] });

    expect(get(allEntries)).toEqual(initialEntries);
    expect(get(allAssets)).toEqual(initialAssets);
    expect(get(contentUpdatesToast)).toEqual(
      expect.objectContaining({
        deleted: true,
        count: 0,
      }),
    );
  });
});

describe('Test deleteEntries()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('creates file changes for entry deletion', async () => {
    const { saveChanges } = await import('$lib/services/backends/save');
    const { selectedCollection } = await import('$lib/services/contents/collection');

    const mockEntries = [
      {
        id: '1',
        slug: 'post-1',
        locales: {
          en: { path: '/content/posts/post-1.md' },
          es: { path: '/content/posts/es/post-1.md' },
        },
      },
      {
        id: '2',
        slug: 'post-2',
        locales: {
          en: { path: '/content/posts/post-2.md' },
        },
      },
    ];

    selectedCollection.set(/** @type {any} */ ({ name: 'posts' }));

    await deleteEntries(/** @type {any} */ (mockEntries));

    expect(vi.mocked(saveChanges)).toHaveBeenCalledWith({
      changes: [
        {
          action: 'delete',
          slug: 'post-1',
          path: '/content/posts/post-1.md',
          previousSha: 'mock-sha-123',
        },
        {
          action: 'delete',
          slug: 'post-1',
          path: '/content/posts/es/post-1.md',
          previousSha: 'mock-sha-123',
        },
        {
          action: 'delete',
          slug: 'post-2',
          path: '/content/posts/post-2.md',
          previousSha: 'mock-sha-123',
        },
      ],
      options: {
        commitType: 'delete',
        collection: { name: 'posts' },
      },
    });
  });

  test('includes asset deletions in file changes', async () => {
    const { saveChanges } = await import('$lib/services/backends/save');

    const mockEntries = [
      {
        id: '1',
        slug: 'post-1',
        locales: {
          en: { path: '/content/posts/post-1.md' },
        },
      },
    ];

    const mockAssets = [
      { path: '/images/image1.jpg', sha: 'asset-sha-1' },
      { path: '/images/image2.jpg', sha: 'asset-sha-2' },
    ];

    await deleteEntries(/** @type {any} */ (mockEntries), /** @type {any} */ (mockAssets));

    expect(vi.mocked(saveChanges)).toHaveBeenCalledWith({
      changes: [
        {
          action: 'delete',
          slug: 'post-1',
          path: '/content/posts/post-1.md',
          previousSha: 'mock-sha-123',
        },
        { action: 'delete', path: '/images/image1.jpg', previousSha: 'asset-sha-1' },
        { action: 'delete', path: '/images/image2.jpg', previousSha: 'asset-sha-2' },
      ],
      options: {
        commitType: 'delete',
        collection: expect.any(Object),
      },
    });
  });

  test('handles entries with duplicate paths for single file i18n', async () => {
    const { saveChanges } = await import('$lib/services/backends/save');

    const mockEntries = [
      {
        id: '1',
        slug: 'post-1',
        locales: {
          en: { path: '/content/posts/post-1.md' },
          es: { path: '/content/posts/post-1.md' }, // Same path for single file i18n
        },
      },
    ];

    await deleteEntries(/** @type {any} */ (mockEntries));

    // Should only have one delete change for the duplicate path
    expect(vi.mocked(saveChanges)).toHaveBeenCalledWith({
      changes: [
        {
          action: 'delete',
          slug: 'post-1',
          path: '/content/posts/post-1.md',
          previousSha: 'mock-sha-123',
        },
      ],
      options: {
        commitType: 'delete',
        collection: expect.any(Object),
      },
    });
  });

  test('handles non-existent entries gracefully', async () => {
    const { saveChanges } = await import('$lib/services/backends/save');
    const mockEntries = /** @type {any[]} */ ([]);

    await deleteEntries(/** @type {any} */ (mockEntries));

    // Should still call saveChanges with empty changes
    expect(vi.mocked(saveChanges)).toHaveBeenCalledWith({
      changes: [],
      options: {
        commitType: 'delete',
        collection: expect.any(Object),
      },
    });
  });

  test('calls updateStores after successful save', async () => {
    const { allEntries } = await import('$lib/services/contents');
    const { contentUpdatesToast } = await import('$lib/services/contents/collection/data');

    const mockEntries = [
      {
        id: '1',
        slug: 'post-1',
        locales: { en: { path: '/content/posts/post-1.md' } },
      },
      {
        id: '2',
        slug: 'post-2',
        locales: { en: { path: '/content/posts/post-2.md' } },
      },
    ];

    allEntries.set(/** @type {any} */ (mockEntries));

    const mockAssets = [{ path: '/images/image.jpg', sha: 'asset-sha' }];

    await deleteEntries(/** @type {any} */ ([mockEntries[0]]), /** @type {any} */ (mockAssets));

    // Verify stores are updated with correct IDs and asset paths
    expect(get(allEntries)).toEqual([
      {
        id: '2',
        slug: 'post-2',
        locales: { en: { path: '/content/posts/post-2.md' } },
      },
    ]);

    expect(get(contentUpdatesToast)).toEqual(
      expect.objectContaining({
        deleted: true,
        count: 1,
      }),
    );
  });

  test('handles entries without locales', async () => {
    const { saveChanges } = await import('$lib/services/backends/save');

    const mockEntries = [
      {
        id: '2',
        slug: 'post-2',
        locales: { en: { path: '/content/posts/post-2.md' } },
      },
    ];

    await deleteEntries(/** @type {any} */ (mockEntries));

    expect(vi.mocked(saveChanges)).toHaveBeenCalledWith({
      changes: [
        {
          action: 'delete',
          slug: 'post-2',
          path: '/content/posts/post-2.md',
          previousSha: 'mock-sha-123',
        },
      ],
      options: {
        commitType: 'delete',
        collection: expect.any(Object),
      },
    });
  });

  test('handles deleteEntries when backend repository is undefined', async () => {
    const { saveChanges } = await import('$lib/services/backends/save');

    // Backend is already mocked as null by default in the vi.mock setup

    const mockEntries = [
      {
        id: '1',
        slug: 'post-1',
        locales: {
          en: { path: '/content/posts/post-1.md' },
        },
      },
    ];

    await deleteEntries(/** @type {any} */ (mockEntries));

    // Should still call saveChanges even without cacheDB
    expect(vi.mocked(saveChanges)).toHaveBeenCalled();
  });

  test('handles deleteEntries when backend has no databaseName', async () => {
    const { saveChanges } = await import('$lib/services/backends/save');

    // Backend without databaseName is already mocked in the vi.mock setup

    const mockEntries = [
      {
        id: '1',
        slug: 'post-1',
        locales: {
          en: { path: '/content/posts/post-1.md' },
        },
      },
    ];

    await deleteEntries(/** @type {any} */ (mockEntries));

    // Should still call saveChanges without cacheDB
    expect(vi.mocked(saveChanges)).toHaveBeenCalled();
  });

  test('deleteEntries with duplicate locale paths uses unique', async () => {
    const { saveChanges } = await import('$lib/services/backends/save');
    const { selectedCollection } = await import('$lib/services/contents/collection');

    const mockEntries = [
      {
        id: '1',
        slug: 'post-1',
        locales: {
          en: { path: '/content/posts/post-1.md' },
          en_US: { path: '/content/posts/post-1.md' },
          en_GB: { path: '/content/posts/post-1.md' },
        },
      },
    ];

    selectedCollection.set(/** @type {any} */ ({ name: 'posts' }));

    await deleteEntries(/** @type {any} */ (mockEntries));

    expect(vi.mocked(saveChanges)).toHaveBeenCalled();
  });

  test('deleteEntries with backend databaseName initializes cacheDB', async () => {
    const { backend } = await import('$lib/services/backends');
    const { saveChanges } = await import('$lib/services/backends/save');
    const { IndexedDB } = await import('@sveltia/utils/storage');

    // Mock backend with valid databaseName
    vi.mocked(backend).subscribe = vi.fn((handler) => {
      handler(
        /** @type {any} */ ({
          repository: { databaseName: 'my-database' },
        }),
      );

      return () => {};
    });

    const mockEntries = [
      {
        id: '1',
        slug: 'post-1',
        locales: { en: { path: '/content/posts/post-1.md' } },
      },
    ];

    await deleteEntries(/** @type {any} */ (mockEntries));

    // IndexedDB should have been called with the database name
    expect(IndexedDB).toBeDefined();
    expect(vi.mocked(saveChanges)).toHaveBeenCalled();
  });
});
