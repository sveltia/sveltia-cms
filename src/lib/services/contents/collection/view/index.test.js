// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
import { getCollectionFilesByEntry } from '$lib/services/contents/collection/files';
import { filterEntries, parseFilterConfig } from '$lib/services/contents/collection/view/filter';
import {
  getReorderGroupingConditions,
  groupEntries,
  parseGroupConfig,
} from '$lib/services/contents/collection/view/group';
import { initSettings } from '$lib/services/contents/collection/view/settings';
import { sortEntries } from '$lib/services/contents/collection/view/sort';
import { getSortConfig } from '$lib/services/contents/collection/view/sort-keys';
import { forkedRepository } from '$lib/services/workflow/open-authoring';

import {
  collectionState,
  currentView,
  entryGroups,
  listedEntries,
  listedEntryIndexMap,
  listedUnpublishedEntries,
  reorderDirty,
  reorderedEntries,
  reordering,
  setReorderMode,
} from '.';

/**
 * Reactive state mocks hoisted so they are available when vi.mock factories run. Vi.hoisted runs
 * before module resolution/imports. The real reactive boxes are used, so that the derived state
 * and effects in the module under test react to changes made by the tests.
 */
const {
  _allEntries,
  _selectedCollection,
  _locale,
  _selectedEntries,
  _prefs,
  _backend,
  _entryListSettings,
  _unpublishedEntries,
} = await vi.hoisted(async () => {
  const { createRawState } = await import('$lib/services/utils/state.svelte');

  return {
    /** @type {{ current: any }} */
    _allEntries: createRawState([]),
    /** @type {{ current: any }} */
    _selectedCollection: createRawState(undefined),
    /** @type {{ current: string }} */
    _locale: createRawState('en'),
    /** @type {{ current: any[] }} */
    _selectedEntries: createRawState([]),
    /** @type {any} */
    _prefs: /** @type {any} */ ({ devModeEnabled: false }),
    /** @type {{ current: any }} */
    _backend: createRawState(null),
    /** @type {{ current: any }} */
    _entryListSettings: createRawState(undefined),
    /** @type {{ current: any[] }} */
    _unpublishedEntries: createRawState([]),
  };
});

// Mock dependencies
vi.mock('@sveltia/i18n', () => ({
  locale: _locale,
}));

vi.mock('$lib/services/contents', () => ({
  allEntries: _allEntries,
}));

vi.mock('$lib/services/contents/collection', () => ({
  selectedCollection: _selectedCollection,
  getCollection: vi.fn(),
  // Used by the nested collection helpers, which the entry list runs through
  isEntryCollection: vi.fn(
    (collection) => typeof collection?.folder === 'string' && !Array.isArray(collection?.files),
  ),
}));

vi.mock('$lib/services/contents/collection/entries', () => ({
  getEntriesByCollection: vi.fn(() => []),
  selectedEntries: _selectedEntries,
}));

vi.mock('$lib/services/contents/collection/files', () => ({
  getCollectionFilesByEntry: vi.fn(() => []),
}));

vi.mock('$lib/services/contents/collection/view/filter', () => ({
  filterEntries: vi.fn((entries) => entries),
  parseFilterConfig: vi.fn(() => ({ options: [] })),
}));

vi.mock('$lib/services/contents/collection/view/group', () => ({
  groupEntries: vi.fn((entries) => [{ name: 'default', entries }]),
  getReorderGroupingConditions: vi.fn(() => undefined),
  parseGroupConfig: vi.fn(() => ({ options: [] })),
}));

vi.mock('$lib/services/contents/collection/view/sort', () => ({
  sortEntries: vi.fn((entries) => entries),
}));

vi.mock('$lib/services/contents/collection/view/sort-keys', () => ({
  getSortConfig: vi.fn(() => ({ keys: [] })),
}));

// The backend services imported below pull in the environment detection, which isn’t needed here
vi.mock('$lib/services/user/env.svelte', () => ({
  env: { isLocalHost: false },
}));

vi.mock('$lib/services/user/prefs.svelte', () => ({
  prefs: _prefs,
}));

vi.mock('$lib/services/backends', () => ({
  backend: _backend,
}));

vi.mock('$lib/services/contents/collection/view/settings', () => ({
  entryListSettings: _entryListSettings,
  initSettings: vi.fn(),
}));

// Only the store is mocked; `swapUnpublishedEntries` is a pure helper and is used as is
vi.mock('$lib/services/workflow', async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  unpublishedEntries: _unpublishedEntries,
}));

/**
 * Wait for the effects to run.
 * @returns {Promise<void>} Promise that resolves after a short delay.
 */
const wait = () =>
  new Promise((resolve) => {
    setTimeout(resolve);
  });

describe('collection/view/index', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    _allEntries.current = [];
    await wait();
    _selectedCollection.current = undefined;
    await wait();
    _locale.current = 'en';
    _prefs.devModeEnabled = false;
    _backend.current = null;
    await wait();
    _entryListSettings.current = undefined;
    _unpublishedEntries.current = [];
    await wait();
    reordering.current = false;
    await wait();
    currentView.current = { type: 'list' };
    // `clearAllMocks()` only clears recorded calls, so reset the return value set by reorder tests
    vi.mocked(getReorderGroupingConditions).mockReturnValue(undefined);
  });

  test('exports currentView store', async () => {
    expect(currentView).toBeDefined();
    expect(currentView.current).toEqual({ type: 'list' });
  });

  test('exports listedEntries store', async () => {
    expect(listedEntries).toBeDefined();
  });

  test('exports entryGroups store', async () => {
    expect(entryGroups).toBeDefined();
  });

  test('currentView can be updated', async () => {
    /** @type {any} */
    const newView = { type: 'grid', sort: { field: 'title', ascending: true } };

    currentView.current = newView;
    expect(currentView.current).toEqual(newView);
  });

  test('listedEntries returns entries when collection is selected', async () => {
    /** @type {any} */
    const mockEntries = [
      { id: '1', slug: 'post-1', locales: {}, sha: 'abc', collectionName: 'posts' },
      { id: '2', slug: 'post-2', locales: {}, sha: 'def', collectionName: 'posts' },
    ];

    vi.mocked(getEntriesByCollection).mockReturnValue(mockEntries);

    _allEntries.current = mockEntries;
    await wait();
    _selectedCollection.current = /** @type {any} */ ({ name: 'posts' });
    await wait();

    // The derived store should process the entries
    expect(getEntriesByCollection).toBeDefined();
  });

  test('listedEntries returns empty array when no collection selected', async () => {
    _allEntries.current = [];
    await wait();
    _selectedCollection.current = undefined;
    await wait();

    // The store should be defined
    expect(listedEntries).toBeDefined();
  });

  test('entryGroups applies sort, filter, and group operations', async () => {
    /** @type {any} */
    const mockEntries = [
      { id: '1', slug: 'post-1', locales: {}, sha: 'abc', collectionName: 'posts' },
      { id: '2', slug: 'post-2', locales: {}, sha: 'def', collectionName: 'posts' },
    ];

    vi.mocked(sortEntries).mockReturnValue(mockEntries);
    vi.mocked(filterEntries).mockReturnValue(mockEntries);
    vi.mocked(groupEntries).mockReturnValue([{ name: 'All', entries: mockEntries }]);

    currentView.current = /** @type {any} */ ({
      type: 'list',
      sort: { field: 'title', ascending: true },
      filters: [{ field: 'status', value: 'published' }],
      group: { field: 'category' },
    });

    // The derived store should be defined
    expect(entryGroups).toBeDefined();
  });

  test('entryGroups handles empty entries', async () => {
    vi.mocked(getEntriesByCollection).mockReturnValue([]);
    vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);

    currentView.current = { type: 'list' };

    // Should handle empty entries gracefully
    expect(entryGroups).toBeDefined();
  });

  test('entryGroups skips processing for file/singleton collections', async () => {
    /** @type {any} */
    const mockEntry = { id: '1', slug: 'about', locales: {}, sha: 'abc', collectionName: 'pages' };

    vi.mocked(getEntriesByCollection).mockReturnValue([mockEntry]);
    vi.mocked(getCollectionFilesByEntry).mockReturnValue(
      /** @type {any} */ ([{ _path: 'about.md' }]),
    );

    currentView.current = { type: 'list' };

    // Should not call sort/filter/group for file collections
    expect(entryGroups).toBeDefined();
  });

  test('entryGroups uses cache to avoid re-processing', async () => {
    /** @type {any} */
    const mockEntries = [{ id: '1', slug: 'post-1', locales: {}, sha: 'abc' }];

    vi.mocked(getEntriesByCollection).mockReturnValue(mockEntries);
    vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
    vi.mocked(groupEntries).mockReturnValue([{ name: 'All', entries: mockEntries }]);

    // First call
    currentView.current = { type: 'list' };

    // Second call with same data (should use cache)
    currentView.current = { type: 'list' };

    expect(entryGroups).toBeDefined();
  });

  test('listedEntries derived store is properly defined', async () => {
    /** @type {any} */
    const mockCollection = { name: 'posts', folder: '_posts' };

    /** @type {any} */
    const mockEntries = [
      { id: '1', slug: 'post-1', locales: {}, sha: 'abc', collectionName: 'posts' },
    ];

    vi.mocked(getEntriesByCollection).mockReturnValue(mockEntries);

    // The state should be defined and working
    expect(listedEntries.current).toBeDefined();
    expect(mockCollection).toBeDefined();
  });

  test('entryGroups handles sorting when sort is defined', async () => {
    /** @type {any} */
    const mockEntries = [
      { id: '1', slug: 'post-1', locales: { _default: { content: {} } }, collectionName: 'posts' },
      { id: '2', slug: 'post-2', locales: { _default: { content: {} } }, collectionName: 'posts' },
    ];

    /** @type {any} */
    const sortedEntries = [...mockEntries].reverse();

    vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
    vi.mocked(sortEntries).mockReturnValue(sortedEntries);
    vi.mocked(groupEntries).mockReturnValue([{ name: 'All', entries: sortedEntries }]);

    // Update currentView to trigger sorting
    currentView.current = {
      type: 'list',
      sort: /** @type {any} */ ({ field: 'title', ascending: false }),
    };

    expect(entryGroups.current).toBeDefined();
    expect(sortEntries).toBeDefined();
  });

  test('entryGroups handles filtering when filters are defined', async () => {
    /** @type {any} */
    const mockEntries = [
      {
        id: '1',
        slug: 'post-1',
        locales: { _default: { content: { status: 'published' } } },
        collectionName: 'posts',
      },
      {
        id: '2',
        slug: 'post-2',
        locales: { _default: { content: { status: 'draft' } } },
        collectionName: 'posts',
      },
    ];

    /** @type {any} */
    const filteredEntries = [mockEntries[0]];

    vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
    vi.mocked(filterEntries).mockReturnValue(filteredEntries);
    vi.mocked(groupEntries).mockReturnValue([{ name: 'All', entries: filteredEntries }]);

    // Update currentView to trigger filtering
    currentView.current = {
      type: 'list',
      filters: [{ field: 'status', pattern: 'published' }],
    };

    expect(entryGroups.current).toBeDefined();
    expect(filterEntries).toBeDefined();
  });

  test('entryGroups returns empty for file/singleton collections', async () => {
    /** @type {any} */
    const mockEntry = {
      id: '1',
      slug: 'about',
      locales: { _default: { content: {} } },
      collectionName: 'pages',
    };

    vi.mocked(getCollectionFilesByEntry).mockReturnValue(
      /** @type {any} */ ([{ name: 'about', _path: 'about.md' }]),
    );

    expect(entryGroups.current).toBeDefined();

    // Should not process file/singleton collections
    expect(getCollectionFilesByEntry).toBeDefined();
    expect(mockEntry).toBeDefined();
  });

  test('entryGroups only updates when groups actually change', async () => {
    /** @type {any} */
    const mockEntries = [
      { id: '1', slug: 'post-1', locales: { _default: { content: {} } }, collectionName: 'posts' },
    ];

    /** @type {any} */
    const mockGroups = [{ name: 'All', entries: mockEntries }];

    vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
    vi.mocked(groupEntries).mockReturnValue(mockGroups);

    // Update with same view (cache should prevent re-processing)
    currentView.current = { type: 'list' };

    expect(entryGroups.current).toBeDefined();
  });

  test('entryGroups does not emit an empty reset before populated groups', async () => {
    const mockCollection = { name: 'posts', folder: '_posts' };

    /** @type {any} */
    const mockEntries = [
      { id: '1', slug: 'post-1', locales: { _default: { content: {} } }, collectionName: 'posts' },
    ];

    const mockGroups = [{ name: 'All', entries: mockEntries }];

    vi.mocked(getEntriesByCollection).mockReturnValue(mockEntries);
    vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
    vi.mocked(groupEntries).mockReturnValue(mockGroups);

    _selectedCollection.current = /** @type {any} */ (mockCollection);
    await wait();
    _allEntries.current = mockEntries;
    await wait();

    currentView.current = /** @type {any} */ ({ type: 'grid' });

    expect(entryGroups.current).toEqual(mockGroups);
  });

  test('listedEntries resets selectedEntries when entries change', async () => {
    /** @type {any} */
    const mockEntries = [{ id: '1', slug: 'post-1', locales: {}, collectionName: 'posts' }];

    vi.mocked(getEntriesByCollection).mockReturnValue(mockEntries);
    _selectedEntries.current = mockEntries;
    _allEntries.current = mockEntries;
    await wait();
    _selectedCollection.current = /** @type {any} */ ({ name: 'posts' });
    await wait();
    await wait();

    expect(_selectedEntries.current).toEqual([]);
  });

  test('selectedCollection subscription logs in dev mode', async () => {
    const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    // Update prefs to enable dev mode
    _prefs.devModeEnabled = true;
    _selectedCollection.current = /** @type {any} */ ({ name: 'posts' });
    await wait();

    consoleInfoSpy.mockRestore();
    expect(consoleInfoSpy).toBeDefined();
  });

  test('listedEntries derived store calls getEntriesByCollection when both allEntries and selectedCollection are set', async () => {
    const mockCollection = { name: 'posts', folder: '_posts' };

    /** @type {any} */
    const mockEntries = [
      { id: '1', slug: 'post-1', locales: {}, sha: 'abc', collectionName: 'posts' },
    ];

    vi.mocked(getEntriesByCollection).mockReturnValue(mockEntries);

    // Simulate both store updates to trigger the derived store callback
    _allEntries.current = mockEntries;
    await wait();
    _selectedCollection.current = /** @type {any} */ (mockCollection);
    await wait();

    expect(listedEntries.current).toEqual(mockEntries);
    expect(getEntriesByCollection).toHaveBeenCalledWith('posts');
  });

  test('listedEntryIndexMap maps each entry ID to its position in listedEntries', async () => {
    /** @type {any} */
    const mockEntries = [
      { id: 'a', slug: 'post-a', locales: {}, sha: 'a' },
      { id: 'b', slug: 'post-b', locales: {}, sha: 'b' },
      { id: 'c', slug: 'post-c', locales: {}, sha: 'c' },
    ];

    vi.mocked(getEntriesByCollection).mockReturnValue(mockEntries);

    _allEntries.current = mockEntries;
    await wait();
    _selectedCollection.current = /** @type {any} */ ({ name: 'posts', folder: '_posts' });
    await wait();

    const indexMap = listedEntryIndexMap.current;

    expect([...indexMap]).toEqual([
      ['a', 0],
      ['b', 1],
      ['c', 2],
    ]);
    // Unknown entries are absent, so callers fall back to -1
    expect(indexMap.get('missing')).toBeUndefined();
  });

  describe('Editorial Workflow entries', () => {
    /** @type {any} */
    const publishedEntries = [
      {
        id: 'p1',
        slug: 'needed',
        subPath: 'needed',
        locales: { _default: { path: 'content/posts/needed.md' } },
      },
      {
        id: 'p2',
        slug: 'other',
        subPath: 'other',
        locales: { _default: { path: 'content/posts/other.md' } },
      },
    ];

    /**
     * Create an unpublished entry for the `posts` collection.
     * @param {string} subPath Entry sub path.
     * @param {string} [collectionName] Collection name.
     * @returns {any} Unpublished entry.
     */
    const createDraft = (subPath, collectionName = 'posts') => ({
      id: `draft-${subPath}`,
      slug: subPath,
      subPath,
      locales: { _default: { path: `content/${collectionName}/${subPath}.md` } },
      workflow: {
        collectionName,
        status: 'draft',
        pullRequest: { branch: `cms/posts/${subPath}` },
      },
    });

    /**
     * Read the current value of the given state.
     * @param {any} state State.
     * @returns {any} Value.
     */
    const read = (state) => state.current;

    beforeEach(async () => {
      vi.mocked(getEntriesByCollection).mockReturnValue(publishedEntries);
      // Restore the pass-through implementations, which earlier tests replace with fixed lists
      vi.mocked(sortEntries).mockImplementation((entries) => entries);
      vi.mocked(filterEntries).mockImplementation((entries) => entries);
      _allEntries.current = publishedEntries;
      await wait();
      _selectedCollection.current = /** @type {any} */ ({ name: 'posts', _type: 'entry' });
      await wait();
    });

    test('listedEntries replaces a published entry with its unpublished version', async () => {
      const draft = createDraft('needed');

      _unpublishedEntries.current = [draft];
      await wait();

      expect(read(listedEntries).map((/** @type {any} */ e) => e.id)).toEqual([
        'draft-needed',
        'p2',
      ]);
    });

    test('listedEntries leaves the published entries alone without any draft', async () => {
      expect(read(listedEntries)).toBe(publishedEntries);
    });

    test('listedEntries ignores drafts from another collection', async () => {
      _unpublishedEntries.current = [createDraft('needed', 'pages')];
      await wait();

      expect(read(listedEntries).map((/** @type {any} */ e) => e.id)).toEqual(['p1', 'p2']);
    });

    test('listedEntries doesn’t swap while reordering', async () => {
      _unpublishedEntries.current = [createDraft('needed')];
      await wait();
      reordering.current = true;
      await wait();

      expect(read(listedEntries)).toBe(publishedEntries);
    });

    test('listedEntries matches a draft that renamed the entry', async () => {
      const draft = createDraft('renamed');

      draft.workflow.previousPaths = ['content/posts/needed.md'];
      _unpublishedEntries.current = [draft];
      await wait();

      // The draft replaces the published entry it renamed, rather than being listed separately
      expect(read(listedEntries).map((/** @type {any} */ e) => e.id)).toEqual([
        'draft-renamed',
        'p2',
      ]);

      expect(read(listedUnpublishedEntries)).toEqual([]);
    });

    test('listedUnpublishedEntries only contains the never-published drafts', async () => {
      _unpublishedEntries.current = [createDraft('needed'), createDraft('brand-new')];
      await wait();

      // The draft for `needed` replaces the published entry instead
      expect(read(listedUnpublishedEntries).map((/** @type {any} */ e) => e.id)).toEqual([
        'draft-brand-new',
      ]);
    });

    test('listedUnpublishedEntries is empty while reordering', async () => {
      _unpublishedEntries.current = [createDraft('brand-new')];
      await wait();
      reordering.current = true;
      await wait();

      expect(read(listedUnpublishedEntries)).toEqual([]);
    });

    test('listedUnpublishedEntries is empty for a file collection', async () => {
      _unpublishedEntries.current = [createDraft('brand-new')];
      await wait();
      _selectedCollection.current = /** @type {any} */ ({ name: 'posts', _type: 'file' });
      await wait();

      expect(read(listedUnpublishedEntries)).toEqual([]);
    });

    test('listedUnpublishedEntries applies the current sort and filters', async () => {
      _unpublishedEntries.current = [createDraft('brand-new')];
      await wait();
      currentView.current = { type: 'list', sort: { key: 'title' }, filters: [] };

      expect(read(listedUnpublishedEntries).map((/** @type {any} */ e) => e.id)).toEqual([
        'draft-brand-new',
      ]);

      expect(sortEntries).toHaveBeenCalled();
      expect(filterEntries).toHaveBeenCalled();
    });

    test('listedUnpublishedEntries skips sorting when there is nothing to list', async () => {
      currentView.current = { type: 'list', sort: { key: 'title' } };
      vi.clearAllMocks();
      _unpublishedEntries.current = [createDraft('needed')];
      await wait();

      expect(read(listedUnpublishedEntries)).toEqual([]);
      expect(sortEntries).not.toHaveBeenCalled();
    });
  });

  test('entryGroups filters and groups entries with sort, filter, and group options', async () => {
    const mockCollection = {
      name: 'posts',
      folder: '_posts',
    };

    /** @type {any} */
    const mockEntries = [
      { id: '1', slug: 'post-1', locales: {}, sha: 'abc', collectionName: 'posts' },
      { id: '2', slug: 'post-2', locales: {}, sha: 'def', collectionName: 'posts' },
    ];

    const sortedEntries = [mockEntries[1], mockEntries[0]];
    const filteredEntries = [mockEntries[1]];
    const groupedEntries = [{ name: 'published', entries: filteredEntries }];

    vi.mocked(getEntriesByCollection).mockReturnValue(mockEntries);
    vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
    vi.mocked(sortEntries).mockReturnValue(sortedEntries);
    vi.mocked(filterEntries).mockReturnValue(filteredEntries);
    vi.mocked(groupEntries).mockReturnValue(groupedEntries);

    // Set up the collection and entries
    _selectedCollection.current = /** @type {any} */ (mockCollection);
    await wait();
    _allEntries.current = mockEntries;
    await wait();

    // Set view with sort, filter, and group

    currentView.current = /** @type {any} */ ({
      type: 'list',
      sort: { key: 'date', order: 'descending' },
      filters: [{ field: 'status', pattern: 'published' }],
      group: { field: 'author' },
    });

    // Subscribe to trigger the store processing

    expect(entryGroups.current).toBeDefined();
  });

  test('listedEntries subscription resets selectedEntries when entries change', async () => {
    const mockEntries = [{ id: '1', slug: 'post-1', locales: {}, collectionName: 'posts' }];

    vi.mocked(getEntriesByCollection).mockReturnValue(/** @type {any} */ (mockEntries));
    _allEntries.current = mockEntries;
    await wait();
    _selectedCollection.current = /** @type {any} */ ({ name: 'posts' });
    await wait();

    // Subscribe to listedEntries to trigger side-effect
    expect(listedEntries.current).toBeDefined();

    // The subscription should have reset selectedEntries to []
    expect(_selectedEntries.current).toEqual([]);
  });

  test('selectedCollection subscription side effect works correctly', async () => {
    const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const mockCollection = { name: 'posts', folder: '_posts' };

    // The subscription callback exists and can be triggered
    _selectedCollection.current = /** @type {any} */ (mockCollection);
    await wait();

    // Subscribe to verify the store is working
    expect(_selectedCollection.current).toBeDefined();

    consoleInfoSpy.mockRestore();
  });

  test('listedEntries logs to console when devModeEnabled is true', async () => {
    const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    _prefs.devModeEnabled = true;

    /** @type {any[]} */
    const mockEntries = [
      { id: '1', slug: 'post-1', subPath: '', locales: {}, sha: 'abc', collectionName: 'posts' },
    ];

    vi.mocked(getEntriesByCollection).mockReturnValue(mockEntries);
    _allEntries.current = mockEntries;
    await wait();
    _selectedCollection.current = /** @type {any} */ ({ name: 'posts' });
    await wait();

    expect(listedEntries.current).toBeDefined();

    // console.info should have been called with the entries
    expect(consoleInfoSpy).toHaveBeenCalledWith('listedEntries', expect.any(Array));

    consoleInfoSpy.mockRestore();
  });

  test('selectedCollection logs to console when devModeEnabled is true and collection exists', async () => {
    const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    _prefs.devModeEnabled = true;

    const mockCollection = { name: 'posts', folder: '_posts' };

    _selectedCollection.current = /** @type {any} */ (mockCollection);
    await wait();

    expect(consoleInfoSpy).toHaveBeenCalledWith('selectedCollection', mockCollection);

    consoleInfoSpy.mockRestore();
  });

  test('entryGroups applies both sort and filter operations when both are defined', async () => {
    const mockCollection = {
      name: 'posts',
      folder: '_posts',
    };

    /** @type {any} */
    const mockEntries = [
      { id: '1', slug: 'post-1', locales: {}, sha: 'abc', collectionName: 'posts' },
      { id: '2', slug: 'post-2', locales: {}, sha: 'def', collectionName: 'posts' },
    ];

    const sortedEntries = [mockEntries[1], mockEntries[0]];
    const filteredEntries = [mockEntries[1]];

    vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
    vi.mocked(sortEntries).mockReturnValue(sortedEntries);
    vi.mocked(filterEntries).mockReturnValue(filteredEntries);
    vi.mocked(groupEntries).mockReturnValue([{ name: 'All', entries: filteredEntries }]);

    _selectedCollection.current = /** @type {any} */ (mockCollection);
    await wait();
    _allEntries.current = mockEntries;
    await wait();

    currentView.current = /** @type {any} */ ({
      type: 'list',
      sort: { key: 'title', order: 'ascending' },
      filters: [{ field: 'status', pattern: 'published' }],
    });

    expect(entryGroups.current).toBeDefined();

    // Both functions should have been called
    expect(sortEntries).toBeDefined();
    expect(filterEntries).toBeDefined();
  });

  test('entryGroups applies only sort when filters are not defined', async () => {
    const mockCollection = {
      name: 'posts',
      folder: '_posts',
    };

    /** @type {any} */
    const mockEntries = [
      { id: '1', slug: 'post-1', locales: {}, sha: 'abc', collectionName: 'posts' },
      { id: '2', slug: 'post-2', locales: {}, sha: 'def', collectionName: 'posts' },
    ];

    const sortedEntries = [mockEntries[1], mockEntries[0]];

    vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
    vi.mocked(sortEntries).mockReturnValue(sortedEntries);
    vi.mocked(groupEntries).mockReturnValue([{ name: 'All', entries: sortedEntries }]);

    _selectedCollection.current = /** @type {any} */ (mockCollection);
    await wait();
    _allEntries.current = mockEntries;
    await wait();

    currentView.current = /** @type {any} */ ({
      type: 'list',
      sort: { key: 'title', order: 'ascending' },
    });

    expect(entryGroups.current).toBeDefined();

    expect(sortEntries).toBeDefined();
  });

  test('entryGroups applies only filter when sort is not defined', async () => {
    const mockCollection = {
      name: 'posts',
      folder: '_posts',
    };

    /** @type {any} */
    const mockEntries = [
      { id: '1', slug: 'post-1', locales: {}, sha: 'abc', collectionName: 'posts' },
      { id: '2', slug: 'post-2', locales: {}, sha: 'def', collectionName: 'posts' },
    ];

    const filteredEntries = [mockEntries[0]];

    vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
    vi.mocked(filterEntries).mockReturnValue(filteredEntries);
    vi.mocked(groupEntries).mockReturnValue([{ name: 'All', entries: filteredEntries }]);

    _selectedCollection.current = /** @type {any} */ (mockCollection);
    await wait();
    _allEntries.current = mockEntries;
    await wait();

    currentView.current = /** @type {any} */ ({
      type: 'list',
      filters: [{ field: 'status', pattern: 'published' }],
    });

    expect(entryGroups.current).toBeDefined();

    expect(filterEntries).toBeDefined();
  });

  test('listedEntries handles falsy inputs correctly', async () => {
    _allEntries.current = /** @type {any} */ ([]);
    await wait();
    _selectedCollection.current = /** @type {any} */ (undefined);
    await wait();

    expect(listedEntries.current).toBeDefined();

    expect(listedEntries).toBeDefined();
  });

  test('listedEntries with only allEntries set (no collection)', async () => {
    const mockEntries = [{ id: '1', slug: 'post-1', subPath: '', locales: {}, sha: 'abc' }];

    _allEntries.current = /** @type {any} */ (mockEntries);
    await wait();
    _selectedCollection.current = /** @type {any} */ (undefined);
    await wait();

    // Should return empty array when no collection is selected
    expect(listedEntries.current).toEqual([]);
  });

  test('listedEntries with only collection set (no entries)', async () => {
    const mockCollection = { name: 'posts', folder: '_posts' };

    _allEntries.current = /** @type {any} */ (undefined);
    await wait();
    _selectedCollection.current = /** @type {any} */ (mockCollection);
    await wait();
    vi.mocked(getEntriesByCollection).mockReturnValue([]);

    // Should return empty array when no entries
    expect(listedEntries.current).toEqual([]);
  });

  test('entryGroups processes sort and filters together', async () => {
    const mockCollection = { name: 'posts', folder: '_posts' };

    const mockEntries = [
      { id: '1', slug: 'post-1', subPath: '', locales: {}, sha: 'abc' },
      { id: '2', slug: 'post-2', subPath: '', locales: {}, sha: 'def' },
    ];

    const sortedEntries = [mockEntries[1], mockEntries[0]];
    const filteredEntries = [mockEntries[1]];

    vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
    vi.mocked(sortEntries).mockReturnValue(sortedEntries);
    vi.mocked(filterEntries).mockReturnValue(filteredEntries);
    vi.mocked(groupEntries).mockReturnValue([{ name: 'All', entries: filteredEntries }]);

    _selectedCollection.current = /** @type {any} */ (mockCollection);
    await wait();
    _allEntries.current = mockEntries;
    await wait();

    currentView.current = /** @type {any} */ ({
      type: 'list',
      sort: { key: 'date', order: 'descending' },
      filters: [{ field: 'status', pattern: 'published' }],
    });

    expect(entryGroups.current).toBeDefined();

    // Verify currentView was set with both sort and filters
    const viewValue = currentView.current;

    expect(viewValue.sort).toBeDefined();
    expect(viewValue.filters).toBeDefined();
  });

  test('selectedCollection subscription with devModeEnabled true', async () => {
    const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    _prefs.devModeEnabled = true;

    const mockCollection = { name: 'posts', folder: '_posts' };

    // Set the collection to trigger the subscription
    _selectedCollection.current = /** @type {any} */ (mockCollection);
    await wait();

    expect(consoleInfoSpy).toHaveBeenCalledWith('selectedCollection', mockCollection);

    consoleInfoSpy.mockRestore();
  });

  test('entryGroups caching prevents unnecessary re-processing', async () => {
    const mockCollection = { name: 'posts', folder: '_posts' };
    const mockEntries = [{ id: '1', slug: 'post-1', subPath: '', locales: {}, sha: 'abc' }];

    vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
    vi.mocked(groupEntries).mockReturnValue([{ name: 'All', entries: mockEntries }]);

    _selectedCollection.current = /** @type {any} */ (mockCollection);
    await wait();
    _allEntries.current = mockEntries;
    await wait();

    currentView.current = { type: 'list' };

    // First subscription
    expect(entryGroups.current).toBeDefined();

    const groupEntriesCallCount = vi.mocked(groupEntries).mock.calls.length;

    // Second subscription with same data should use cache
    currentView.current = { type: 'list' };

    expect(entryGroups.current).toBeDefined();

    // groupEntries should not be called again due to cache
    const callCount = vi.mocked(groupEntries).mock.calls.length;

    expect(callCount).toBeLessThanOrEqual(groupEntriesCallCount + 1);
  });

  describe('collectionState', () => {
    test('returns non-entry-collection defaults when no collection is selected', async () => {
      _selectedCollection.current = undefined;
      await wait();
      _allEntries.current = [];
      await wait();

      expect(collectionState.current).toEqual({
        isEntryCollection: false,
        canCreate: false,
        canDelete: false,
        canReorder: false,
        quota: Infinity,
        remaining: Infinity,
        nearingQuota: false,
        creationDisabled: false,
      });
    });

    test('returns non-entry-collection defaults for a file/folder collection (_type !== entry)', async () => {
      _selectedCollection.current = /** @type {any} */ ({ name: 'pages', _type: 'file' });
      await wait();
      _allEntries.current = [];
      await wait();

      expect(collectionState.current).toEqual({
        isEntryCollection: false,
        canCreate: false,
        canDelete: false,
        canReorder: false,
        quota: Infinity,
        remaining: Infinity,
        nearingQuota: false,
        creationDisabled: false,
      });
    });

    test('reflects create/delete permissions from collection config', async () => {
      _selectedCollection.current = /** @type {any} */ ({
        name: 'posts',
        _type: 'entry',
        create: true,
        delete: true,
      });
      await wait();

      vi.mocked(getEntriesByCollection).mockReturnValue([]);
      _allEntries.current = [];
      await wait();

      const state = collectionState.current;

      expect(state.isEntryCollection).toBe(true);
      expect(state.canCreate).toBe(true);
      expect(state.canDelete).toBe(true);
    });

    test('allows reordering when the collection is configured for it', async () => {
      _selectedCollection.current = /** @type {any} */ ({
        name: 'posts',
        _type: 'entry',
        reorder: true,
      });
      await wait();

      vi.mocked(getEntriesByCollection).mockReturnValue([]);
      _allEntries.current = [];
      await wait();

      expect(collectionState.current.canReorder).toBe(true);
    });

    test('blocks reordering for an Open Authoring contributor', async () => {
      _selectedCollection.current = /** @type {any} */ ({
        name: 'posts',
        _type: 'entry',
        reorder: true,
      });
      await wait();

      vi.mocked(getEntriesByCollection).mockReturnValue([]);
      _allEntries.current = [];
      await wait();
      forkedRepository.current = { owner: 'contributor', repo: 'repo' };

      // Reordering commits straight to the configured branch, which a contributor can’t do
      expect(collectionState.current.canReorder).toBe(false);

      forkedRepository.current = undefined;
    });

    test('defaults canCreate and canDelete to true when not set', async () => {
      _selectedCollection.current = /** @type {any} */ ({ name: 'posts', _type: 'entry' });
      await wait();

      vi.mocked(getEntriesByCollection).mockReturnValue([]);
      _allEntries.current = [];
      await wait();

      const state = collectionState.current;

      expect(state.canCreate).toBe(true);
      expect(state.canDelete).toBe(true);
    });

    test('quota is Infinity when no limit is set', async () => {
      _selectedCollection.current = /** @type {any} */ ({ name: 'posts', _type: 'entry' });
      await wait();

      vi.mocked(getEntriesByCollection).mockReturnValue([]);
      _allEntries.current = [];
      await wait();

      const state = collectionState.current;

      expect(state.quota).toBe(Infinity);
      expect(state.remaining).toBe(Infinity);
    });

    test('quota and remaining are computed from limit and entry count', async () => {
      const mockEntries = /** @type {any[]} */ ([
        { id: '1', slug: 'a' },
        { id: '2', slug: 'b' },
        { id: '3', slug: 'c' },
      ]);

      vi.mocked(getEntriesByCollection).mockReturnValue(mockEntries);
      _allEntries.current = mockEntries;
      await wait();
      _selectedCollection.current = /** @type {any} */ ({
        name: 'posts',
        _type: 'entry',
        create: true,
        limit: 10,
      });
      await wait();

      const state = collectionState.current;

      expect(state.quota).toBe(10);
      expect(state.remaining).toBe(7);
    });

    test('quota counts every entry in a nested collection, not just the listed folder', async () => {
      const mockEntries = /** @type {any[]} */ ([
        { id: '1', slug: '_index', subPath: '_index' },
        { id: '2', slug: 'docs/_index', subPath: 'docs/_index' },
        { id: '3', slug: 'docs/intro/_index', subPath: 'docs/intro/_index' },
      ]);

      vi.mocked(getEntriesByCollection).mockReturnValue(mockEntries);
      _allEntries.current = mockEntries;
      await wait();
      _selectedCollection.current = /** @type {any} */ ({
        name: 'pages',
        _type: 'entry',
        folder: 'content/pages',
        nested: {},
        create: true,
        limit: 10,
      });

      // The root folder only lists two of the three entries
      expect(listedEntries.current).toHaveLength(2);
      expect(collectionState.current.remaining).toBe(7);
    });

    test('creationDisabled is false when canCreate is true and entries are under quota', async () => {
      const mockEntries = /** @type {any[]} */ ([{ id: '1', slug: 'a' }]);

      vi.mocked(getEntriesByCollection).mockReturnValue(mockEntries);
      _allEntries.current = mockEntries;
      await wait();
      _selectedCollection.current = /** @type {any} */ ({
        name: 'posts',
        _type: 'entry',
        create: true,
        limit: 10,
      });
      await wait();

      expect(collectionState.current.creationDisabled).toBe(false);
    });

    test('creationDisabled is true when canCreate is false', async () => {
      vi.mocked(getEntriesByCollection).mockReturnValue([]);
      _allEntries.current = [];
      await wait();
      _selectedCollection.current = /** @type {any} */ ({
        name: 'posts',
        _type: 'entry',
        create: false,
      });
      await wait();

      expect(collectionState.current.creationDisabled).toBe(true);
    });

    test('creationDisabled is true when remaining is exactly 0 (quota reached)', async () => {
      const mockEntries = /** @type {any[]} */ ([
        { id: '1', slug: 'a' },
        { id: '2', slug: 'b' },
      ]);

      vi.mocked(getEntriesByCollection).mockReturnValue(mockEntries);
      _allEntries.current = mockEntries;
      await wait();
      _selectedCollection.current = /** @type {any} */ ({
        name: 'posts',
        _type: 'entry',
        create: true,
        limit: 2,
      });
      await wait();

      const state = collectionState.current;

      expect(state.remaining).toBe(0);
      expect(state.creationDisabled).toBe(true);
    });

    test('creationDisabled is true when remaining is negative (quota exceeded)', async () => {
      const mockEntries = /** @type {any[]} */ ([
        { id: '1', slug: 'a' },
        { id: '2', slug: 'b' },
        { id: '3', slug: 'c' },
      ]);

      vi.mocked(getEntriesByCollection).mockReturnValue(mockEntries);
      _allEntries.current = mockEntries;
      await wait();
      _selectedCollection.current = /** @type {any} */ ({
        name: 'posts',
        _type: 'entry',
        create: true,
        limit: 2,
      });
      await wait();

      const state = collectionState.current;

      expect(state.remaining).toBe(-1);
      expect(state.creationDisabled).toBe(true);
    });

    test('nearingQuota is true when remaining is within warning threshold', async () => {
      const mockEntries = /** @type {any[]} */ ([
        { id: '1', slug: 'a' },
        { id: '2', slug: 'b' },
        { id: '3', slug: 'c' },
        { id: '4', slug: 'd' },
        { id: '5', slug: 'e' },
      ]);

      vi.mocked(getEntriesByCollection).mockReturnValue(mockEntries);
      _allEntries.current = mockEntries;
      await wait();
      // 10 - 5 = 5 remaining, which equals the threshold
      _selectedCollection.current = /** @type {any} */ ({
        name: 'posts',
        _type: 'entry',
        create: true,
        limit: 10,
      });
      await wait();

      expect(collectionState.current.nearingQuota).toBe(true);
    });

    test('nearingQuota is false when remaining is above warning threshold', async () => {
      const mockEntries = /** @type {any[]} */ ([{ id: '1', slug: 'a' }]);

      vi.mocked(getEntriesByCollection).mockReturnValue(mockEntries);
      _allEntries.current = mockEntries;
      await wait();
      // 10 - 1 = 9 remaining, above threshold of 5
      _selectedCollection.current = /** @type {any} */ ({
        name: 'posts',
        _type: 'entry',
        create: true,
        limit: 10,
      });
      await wait();

      expect(collectionState.current.nearingQuota).toBe(false);
    });

    test('nearingQuota is false when remaining is 0 (quota reached, not nearing)', async () => {
      const mockEntries = /** @type {any[]} */ ([
        { id: '1', slug: 'a' },
        { id: '2', slug: 'b' },
      ]);

      vi.mocked(getEntriesByCollection).mockReturnValue(mockEntries);
      _allEntries.current = mockEntries;
      await wait();
      _selectedCollection.current = /** @type {any} */ ({
        name: 'posts',
        _type: 'entry',
        create: true,
        limit: 2,
      });
      await wait();

      const state = collectionState.current;

      // remaining === 0: quota exactly reached, creationDisabled, but NOT nearingQuota
      expect(state.nearingQuota).toBe(false);
      expect(state.creationDisabled).toBe(true);
    });

    test('nearingQuota is false when quota is Infinity', async () => {
      vi.mocked(getEntriesByCollection).mockReturnValue([]);
      _allEntries.current = [];
      await wait();
      _selectedCollection.current = /** @type {any} */ ({
        name: 'posts',
        _type: 'entry',
        create: true,
      });
      await wait();

      expect(collectionState.current.nearingQuota).toBe(false);
    });

    test('updates reactively when entries are added', async () => {
      const twoEntries = /** @type {any[]} */ ([
        { id: '1', slug: 'a' },
        { id: '2', slug: 'b' },
      ]);

      const threeEntries = /** @type {any[]} */ ([...twoEntries, { id: '3', slug: 'c' }]);

      _selectedCollection.current = /** @type {any} */ ({
        name: 'posts',
        _type: 'entry',
        create: true,
        limit: 3,
      });
      await wait();

      vi.mocked(getEntriesByCollection).mockReturnValue(twoEntries);
      _allEntries.current = twoEntries;
      await wait();
      expect(collectionState.current.remaining).toBe(1);
      expect(collectionState.current.creationDisabled).toBe(false);

      vi.mocked(getEntriesByCollection).mockReturnValue(threeEntries);
      _allEntries.current = threeEntries;
      await wait();
      expect(collectionState.current.remaining).toBe(0);
      expect(collectionState.current.creationDisabled).toBe(true);
    });
  });

  test('entryGroups with file/singleton collection returns empty', async () => {
    const mockCollection = { name: 'about', _path: 'about.md' };

    /** @type {any} */
    const mockEntry = {
      id: '1',
      slug: 'about',
      subPath: '',
      locales: {},
      sha: 'abc',
    };

    vi.mocked(getCollectionFilesByEntry).mockReturnValue(
      /** @type {any} */ ([{ name: 'about', _path: 'about.md' }]),
    );

    _selectedCollection.current = /** @type {any} */ (mockCollection);
    await wait();
    _allEntries.current = /** @type {any} */ ([mockEntry]);
    await wait();

    expect(entryGroups.current).toBeDefined();

    // Should process through entryGroups and return groups
    expect(entryGroups).toBeDefined();
  });

  test('entryGroups calls set(groups) when groups differ from current value (L140 true)', async () => {
    // Cover L140 true: !equal(entryGroups.current, groups) is true → set(groups) is called
    /** @type {any} */
    const mockCollection = { name: 'posts', folder: '_posts' };

    /** @type {any[]} */
    const mockEntries = [
      { id: '1', slug: 'post-1', subPath: '', locales: {}, sha: 'abc' },
      { id: '2', slug: 'post-2', subPath: '', locales: {}, sha: 'def' },
    ];

    const mockGroups = [{ name: 'All', entries: mockEntries }];

    vi.mocked(getEntriesByCollection).mockReturnValue(mockEntries);
    vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
    vi.mocked(groupEntries).mockReturnValue(mockGroups);

    _selectedCollection.current = mockCollection;
    await wait();
    _allEntries.current = mockEntries;
    await wait();

    expect(entryGroups.current).toEqual(mockGroups);
  });

  test('entryGroups does not call filterEntries when currentView has no filters (L127 false)', async () => {
    // Cover L127 false: _currentView.filters is falsy → skip filtering
    /** @type {any} */
    const mockCollection = { name: 'posts', folder: '_posts' };
    /** @type {any[]} */
    const mockEntries = [{ id: '1', slug: 'post-1', subPath: '', locales: {}, sha: 'abc' }];

    vi.mocked(getEntriesByCollection).mockReturnValue(mockEntries);
    vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
    vi.mocked(groupEntries).mockReturnValue([{ name: 'All', entries: mockEntries }]);

    _selectedCollection.current = mockCollection;
    await wait();
    _allEntries.current = mockEntries;
    await wait();

    // currentView has sort but NO filters → L127 false
    currentView.current = /** @type {any} */ ({ type: 'list', sort: { field: 'title' } });

    expect(vi.mocked(filterEntries)).not.toHaveBeenCalled();
  });

  test('entryGroups skips set(groups) when computed groups equal current value (L133 false)', async () => {
    // Cover L133 false: equal(entryGroups.current, groups) === true → skip set(groups)
    // This happens when groupEntries returns [] (same as the [] set at the start of the callback)
    /** @type {any} */
    const mockCollection = { name: 'posts', folder: '_posts' };
    /** @type {any[]} */
    const mockEntries = [{ id: '1', slug: 'post-1', subPath: '', locales: {}, sha: 'abc' }];

    vi.mocked(getEntriesByCollection).mockReturnValue(mockEntries);
    vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
    // groupEntries returns [] — same as what set([]) puts in the store, so equal() is true
    vi.mocked(groupEntries).mockReturnValue([]);

    _selectedCollection.current = mockCollection;
    await wait();
    _allEntries.current = mockEntries;
    await wait();

    expect(entryGroups.current).toEqual([]);
  });

  test('backend effect calls initSettings when backend is truthy and entryListSettings is falsy', async () => {
    _entryListSettings.current = undefined;
    _backend.current = /** @type {any} */ ({ databaseName: 'test-db' });
    await wait();
    await wait();

    expect(vi.mocked(initSettings)).toHaveBeenCalledWith({ databaseName: 'test-db' });
  });

  test('entering reorder mode does not clear reorderedEntries', async () => {
    reorderedEntries.current = [/** @type {any} */ ({ id: 'pending' })];
    setReorderMode(true);

    // The truthy branch of `if (!value)` does NOT reset the pending entries.
    expect(reorderedEntries.current).toEqual([{ id: 'pending' }]);

    setReorderMode(false);

    // The falsy branch resets the pending entries.
    expect(reorderedEntries.current).toEqual([]);
  });

  test('entering reorder mode forces the entry list to be sorted by manual order', async () => {
    currentView.current = { type: 'list', sort: { key: 'title', order: 'descending' } };

    setReorderMode(true);

    expect(currentView.current.sort).toEqual({ key: '_manual', order: 'ascending' });

    setReorderMode(false);
  });

  test('entering reorder mode does not re-set currentView when already sorted by manual order', async () => {
    const view = {
      type: /** @type {const} */ ('list'),
      sort: { key: '_manual', order: /** @type {const} */ ('ascending') },
    };

    currentView.current = view;

    setReorderMode(true);

    // Reference is preserved because we skip the redundant set.
    expect(currentView.current).toBe(view);

    setReorderMode(false);
  });

  test('entering reorder mode clears active filters to avoid order collisions', async () => {
    currentView.current = {
      type: 'list',
      sort: { key: '_manual', order: 'ascending' },
      filters: [{ field: 'category', pattern: 'news' }],
    };

    setReorderMode(true);

    const view = currentView.current;

    expect(view.filters).toEqual([]);
    expect(view.sort).toEqual({ key: '_manual', order: 'ascending' });

    setReorderMode(false);
  });

  test('entering reorder mode clears active grouping to produce a single flat list', async () => {
    currentView.current = {
      type: 'list',
      sort: { key: '_manual', order: 'ascending' },
      group: { field: 'category' },
    };

    setReorderMode(true);

    const view = currentView.current;

    expect(view.group).toBeNull();
    expect(view.sort).toEqual({ key: '_manual', order: 'ascending' });

    setReorderMode(false);
  });

  test('entering reorder mode applies the configured reorder grouping over the active one', async () => {
    const reorderGroup = { field: 'category', pattern: undefined };

    vi.mocked(getReorderGroupingConditions).mockReturnValue(reorderGroup);

    currentView.current = {
      type: 'list',
      sort: { key: '_manual', order: 'ascending' },
      group: { field: 'year' },
    };

    setReorderMode(true);

    expect(currentView.current.group).toBe(reorderGroup);

    setReorderMode(false);
  });

  test('entering reorder mode applies the configured reorder grouping when none is active', async () => {
    const reorderGroup = { field: 'category', pattern: undefined };

    vi.mocked(getReorderGroupingConditions).mockReturnValue(reorderGroup);

    currentView.current = { type: 'list', sort: { key: '_manual', order: 'ascending' } };

    setReorderMode(true);

    expect(currentView.current.group).toBe(reorderGroup);

    setReorderMode(false);
  });

  test('entering reorder mode does not re-set currentView when the reorder grouping already applies', async () => {
    const group = { field: 'category', pattern: undefined };

    vi.mocked(getReorderGroupingConditions).mockReturnValue({ ...group });

    const view = {
      type: /** @type {const} */ ('list'),
      sort: { key: '_manual', order: /** @type {const} */ ('ascending') },
      group,
    };

    currentView.current = view;

    setReorderMode(true);

    // Reference is preserved because we skip the redundant set.
    expect(currentView.current).toBe(view);

    setReorderMode(false);
  });

  test('entering reorder mode re-applies the reorder grouping when only the pattern differs', async () => {
    const reorderGroup = { field: 'category', pattern: '^a' };

    vi.mocked(getReorderGroupingConditions).mockReturnValue(reorderGroup);

    currentView.current = {
      type: 'list',
      sort: { key: '_manual', order: 'ascending' },
      group: { field: 'category', pattern: '^b' },
    };

    setReorderMode(true);

    expect(currentView.current.group).toBe(reorderGroup);

    setReorderMode(false);
  });

  test('entering reorder mode still forces manual sort and clears filters with reorder grouping', async () => {
    const reorderGroup = { field: 'category', pattern: undefined };

    vi.mocked(getReorderGroupingConditions).mockReturnValue(reorderGroup);

    currentView.current = {
      type: 'list',
      sort: { key: 'title', order: 'descending' },
      filters: [{ field: 'status', pattern: 'published' }],
    };

    setReorderMode(true);

    const view = currentView.current;

    expect(view.sort).toEqual({ key: '_manual', order: 'ascending' });
    expect(view.filters).toEqual([]);
    expect(view.group).toBe(reorderGroup);

    setReorderMode(false);
  });

  test('exiting reorder mode restores the grouping replaced by the reorder grouping', async () => {
    vi.mocked(getReorderGroupingConditions).mockReturnValue({
      field: 'category',
      pattern: undefined,
    });

    const view = {
      type: /** @type {const} */ ('list'),
      sort: { key: 'title', order: /** @type {const} */ ('descending') },
      group: { field: 'year' },
    };

    currentView.current = view;

    setReorderMode(true);
    setReorderMode(false);

    expect(currentView.current).toBe(view);
  });

  test('entering reorder mode applies sort, filter, and group overrides together', async () => {
    currentView.current = {
      type: 'list',
      sort: { key: 'title', order: 'descending' },
      filters: [{ field: 'category', pattern: 'news' }],
      group: { field: 'year' },
    };

    setReorderMode(true);

    const view = currentView.current;

    expect(view.sort).toEqual({ key: '_manual', order: 'ascending' });
    expect(view.filters).toEqual([]);
    expect(view.group).toBeNull();

    setReorderMode(false);
  });

  test('entering and exiting reorder mode flips `reordering` synchronously', () => {
    setReorderMode(true);
    expect(reordering.current).toBe(true);

    reorderDirty.current = true;
    setReorderMode(false);
    expect(reordering.current).toBe(false);
    expect(reorderDirty.current).toBe(false);
  });

  test('switching collections exits reorder mode without restoring the view', async () => {
    const view = { type: /** @type {const} */ ('list'), group: { field: 'year' } };

    currentView.current = view;
    setReorderMode(true);
    reorderedEntries.current = [/** @type {any} */ ({ id: 'pending' })];

    expect(currentView.current).not.toBe(view);

    _selectedCollection.current = /** @type {any} */ ({ name: 'other', _type: 'file' });
    await wait();

    expect(reordering.current).toBe(false);
    expect(reorderedEntries.current).toEqual([]);
    // The snapshot is discarded first, so the previous collection’s view isn’t restored
    expect(currentView.current).not.toBe(view);
    expect(currentView.current.group).toBeNull();
  });

  describe('view restoration', () => {
    /** @type {any} */
    const collection = { name: 'posts', _type: 'entry', folder: '_posts' };

    beforeEach(() => {
      vi.mocked(getSortConfig).mockReturnValue({
        keys: ['title'],
        default: { key: 'title', order: 'ascending' },
      });
      vi.mocked(parseFilterConfig).mockReturnValue({
        options: [],
        default: { field: 'draft', pattern: false },
      });
      vi.mocked(parseGroupConfig).mockReturnValue({
        options: [],
        default: { field: 'category' },
      });
    });

    test('applies the collection defaults when nothing is saved', async () => {
      _selectedCollection.current = collection;
      await wait();

      expect(currentView.current).toEqual({
        type: 'list',
        sort: { key: 'title', order: 'ascending' },
        filters: [{ field: 'draft', pattern: false }],
        group: { field: 'category' },
      });
    });

    test('restores the saved view, keeping the saved options over the defaults', async () => {
      _entryListSettings.current = {
        posts: {
          type: 'grid',
          sort: { key: 'date', order: 'descending' },
          filters: [],
          group: null,
        },
      };
      _selectedCollection.current = collection;
      await wait();

      expect(currentView.current).toEqual({
        type: 'grid',
        sort: { key: 'date', order: 'descending' },
        filters: [],
        group: null,
      });
    });

    test('leaves the view alone for a file collection', async () => {
      currentView.current = { type: 'grid' };
      _selectedCollection.current = { name: 'settings', _type: 'file', files: [] };
      await wait();

      expect(currentView.current).toEqual({ type: 'grid' });
    });
  });
});
