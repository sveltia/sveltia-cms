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
    const { contentUpdatesToast, UPDATE_TOAST_DEFAULT_STATE } = await import(
      '$lib/services/contents/collection/data'
    );

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
    const { allEntries } = await import('$lib/services/contents');
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

    allEntries.set(/** @type {any} */ (mockEntries));
    selectedCollection.set(/** @type {any} */ ({ name: 'posts' }));

    await deleteEntries(['1', '2']);

    expect(vi.mocked(saveChanges)).toHaveBeenCalledWith({
      changes: [
        { action: 'delete', slug: 'post-1', path: '/content/posts/post-1.md' },
        { action: 'delete', slug: 'post-1', path: '/content/posts/es/post-1.md' },
        { action: 'delete', slug: 'post-2', path: '/content/posts/post-2.md' },
      ],
      options: {
        commitType: 'delete',
        collection: { name: 'posts' },
      },
    });
  });

  test('includes asset deletions in file changes', async () => {
    const { saveChanges } = await import('$lib/services/backends/save');
    const { allEntries } = await import('$lib/services/contents');

    const mockEntries = [
      {
        id: '1',
        slug: 'post-1',
        locales: {
          en: { path: '/content/posts/post-1.md' },
        },
      },
    ];

    allEntries.set(/** @type {any} */ (mockEntries));

    const assetPaths = ['/images/image1.jpg', '/images/image2.jpg'];

    await deleteEntries(['1'], assetPaths);

    expect(vi.mocked(saveChanges)).toHaveBeenCalledWith({
      changes: [
        { action: 'delete', slug: 'post-1', path: '/content/posts/post-1.md' },
        { action: 'delete', path: '/images/image1.jpg' },
        { action: 'delete', path: '/images/image2.jpg' },
      ],
      options: {
        commitType: 'delete',
        collection: expect.any(Object),
      },
    });
  });

  test('handles entries with duplicate paths for single file i18n', async () => {
    const { saveChanges } = await import('$lib/services/backends/save');
    const { allEntries } = await import('$lib/services/contents');

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

    allEntries.set(/** @type {any} */ (mockEntries));

    await deleteEntries(['1']);

    // Should only have one delete change for the duplicate path
    expect(vi.mocked(saveChanges)).toHaveBeenCalledWith({
      changes: [{ action: 'delete', slug: 'post-1', path: '/content/posts/post-1.md' }],
      options: {
        commitType: 'delete',
        collection: expect.any(Object),
      },
    });
  });

  test('handles non-existent entries gracefully', async () => {
    const { saveChanges } = await import('$lib/services/backends/save');
    const { allEntries } = await import('$lib/services/contents');

    allEntries.set([]);

    await deleteEntries(['non-existent-1', 'non-existent-2']);

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

    await deleteEntries(['1'], ['/images/image.jpg']);

    // Verify stores are updated
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
    const { allEntries } = await import('$lib/services/contents');

    const mockEntries = [
      { id: '1', slug: 'post-1' }, // Entry without locales
      {
        id: '2',
        slug: 'post-2',
        locales: { en: { path: '/content/posts/post-2.md' } },
      },
    ];

    allEntries.set(/** @type {any} */ (mockEntries));

    await deleteEntries(['1', '2']);

    expect(vi.mocked(saveChanges)).toHaveBeenCalledWith({
      changes: [{ action: 'delete', slug: 'post-2', path: '/content/posts/post-2.md' }],
      options: {
        commitType: 'delete',
        collection: expect.any(Object),
      },
    });
  });
});
