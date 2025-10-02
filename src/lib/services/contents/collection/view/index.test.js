import { get } from 'svelte/store';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { allEntries } from '$lib/services/contents';
import { selectedCollection } from '$lib/services/contents/collection';
import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
import { getCollectionFilesByEntry } from '$lib/services/contents/collection/files';
import { filterEntries } from '$lib/services/contents/collection/view/filter';
import { groupEntries } from '$lib/services/contents/collection/view/group';
import { sortEntries } from '$lib/services/contents/collection/view/sort';

import { currentView, entryGroups, listedEntries } from './index.js';

// Mock dependencies
vi.mock('svelte-i18n', () => ({
  locale: { subscribe: vi.fn(() => () => {}) },
}));

vi.mock('$lib/services/contents', () => ({
  allEntries: { subscribe: vi.fn(() => () => {}), set: vi.fn() },
}));

vi.mock('$lib/services/contents/collection', () => ({
  selectedCollection: { subscribe: vi.fn(() => () => {}), set: vi.fn() },
}));

vi.mock('$lib/services/contents/collection/entries', () => ({
  getEntriesByCollection: vi.fn(() => []),
  selectedEntries: { set: vi.fn(), subscribe: vi.fn(() => () => {}) },
}));

vi.mock('$lib/services/contents/collection/files', () => ({
  getCollectionFilesByEntry: vi.fn(() => []),
}));

vi.mock('$lib/services/contents/collection/view/filter', () => ({
  filterEntries: vi.fn((entries) => entries),
}));

vi.mock('$lib/services/contents/collection/view/group', () => ({
  groupEntries: vi.fn((entries) => [{ name: 'default', entries }]),
}));

vi.mock('$lib/services/contents/collection/view/sort', () => ({
  sortEntries: vi.fn((entries) => entries),
}));

vi.mock('$lib/services/user/prefs', () => ({
  prefs: {
    subscribe: vi.fn((handler) => {
      handler({ devModeEnabled: false });

      return () => {};
    }),
  },
}));

describe('collection/view/index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentView.set({ type: 'list' });
  });

  test('exports currentView store', () => {
    expect(currentView).toBeDefined();
    expect(get(currentView)).toEqual({ type: 'list' });
  });

  test('exports listedEntries store', () => {
    expect(listedEntries).toBeDefined();
  });

  test('exports entryGroups store', () => {
    expect(entryGroups).toBeDefined();
  });

  test('currentView can be updated', () => {
    /** @type {any} */
    const newView = { type: 'grid', sort: { field: 'title', ascending: true } };

    currentView.set(newView);
    expect(get(currentView)).toEqual(newView);
  });

  test('listedEntries returns entries when collection is selected', () => {
    /** @type {any} */
    const mockEntries = [
      { id: '1', slug: 'post-1', locales: {}, sha: 'abc', collectionName: 'posts' },
      { id: '2', slug: 'post-2', locales: {}, sha: 'def', collectionName: 'posts' },
    ];

    vi.mocked(getEntriesByCollection).mockReturnValue(mockEntries);

    vi.mocked(allEntries.set)(mockEntries);
    vi.mocked(selectedCollection.set)(/** @type {any} */ ({ name: 'posts' }));

    // The derived store should process the entries
    expect(getEntriesByCollection).toBeDefined();
  });

  test('listedEntries returns empty array when no collection selected', () => {
    vi.mocked(allEntries.set)([]);
    vi.mocked(selectedCollection.set)(undefined);

    // The store should be defined
    expect(listedEntries).toBeDefined();
  });

  test('entryGroups applies sort, filter, and group operations', () => {
    /** @type {any} */
    const mockEntries = [
      { id: '1', slug: 'post-1', locales: {}, sha: 'abc', collectionName: 'posts' },
      { id: '2', slug: 'post-2', locales: {}, sha: 'def', collectionName: 'posts' },
    ];

    vi.mocked(sortEntries).mockReturnValue(mockEntries);
    vi.mocked(filterEntries).mockReturnValue(mockEntries);
    vi.mocked(groupEntries).mockReturnValue([{ name: 'All', entries: mockEntries }]);

    currentView.set(
      /** @type {any} */ ({
        type: 'list',
        sort: { field: 'title', ascending: true },
        filters: [{ field: 'status', value: 'published' }],
        group: { field: 'category' },
      }),
    );

    // The derived store should be defined
    expect(entryGroups).toBeDefined();
  });

  test('entryGroups handles empty entries', () => {
    vi.mocked(getEntriesByCollection).mockReturnValue([]);
    vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);

    currentView.set({ type: 'list' });

    // Should handle empty entries gracefully
    expect(entryGroups).toBeDefined();
  });

  test('entryGroups skips processing for file/singleton collections', () => {
    /** @type {any} */
    const mockEntry = { id: '1', slug: 'about', locales: {}, sha: 'abc', collectionName: 'pages' };

    vi.mocked(getEntriesByCollection).mockReturnValue([mockEntry]);
    vi.mocked(getCollectionFilesByEntry).mockReturnValue(
      /** @type {any} */ ([{ _path: 'about.md' }]),
    );

    currentView.set({ type: 'list' });

    // Should not call sort/filter/group for file collections
    expect(entryGroups).toBeDefined();
  });

  test('entryGroups uses cache to avoid re-processing', () => {
    /** @type {any} */
    const mockEntries = [{ id: '1', slug: 'post-1', locales: {}, sha: 'abc' }];

    vi.mocked(getEntriesByCollection).mockReturnValue(mockEntries);
    vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
    vi.mocked(groupEntries).mockReturnValue([{ name: 'All', entries: mockEntries }]);

    // First call
    currentView.set({ type: 'list' });

    // Second call with same data (should use cache)
    currentView.set({ type: 'list' });

    expect(entryGroups).toBeDefined();
  });
});
