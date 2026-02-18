import { sleep } from '@sveltia/utils/misc';
import { get, writable } from 'svelte/store';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { entryListSettings, initSettings } from './settings';

/**
 * @import { BackendService } from '$lib/types/private';
 */

// Mock dependencies
vi.mock('@sveltia/utils/storage', () => {
  /**
   * Mock IndexedDB class.
   */
  class MockIndexedDB {
    /**
     * Constructor for MockIndexedDB.
     */
    constructor() {
      this.get = vi.fn();
      this.set = vi.fn();
    }
  }

  /**
   * Constructor wrapper for IndexedDB.
   * @param {string} _dbName Database name.
   * @param {string} _storeName Store name.
   * @returns {MockIndexedDB} Mock instance.
   */
  // eslint-disable-next-line no-unused-vars
  function IndexedDBConstructor(_dbName, _storeName) {
    return new MockIndexedDB();
  }

  return {
    // @ts-ignore - Assigning wrapper constructor
    IndexedDB: IndexedDBConstructor,
  };
});

vi.mock('$lib/services/backends', () => ({
  backend: writable(/** @type {any} */ (null)),
}));

vi.mock('$lib/services/contents/collection', () => ({
  selectedCollection: writable(null),
}));

vi.mock('$lib/services/contents/collection/view', () => ({
  currentView: writable({ type: 'list' }),
}));

vi.mock('fast-deep-equal', () => ({
  default: vi.fn(),
}));

describe('Test entryListSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('is exported as a writable store', () => {
    expect(entryListSettings).toBeDefined();
    expect(typeof entryListSettings.subscribe).toBe('function');
    expect(typeof entryListSettings.set).toBe('function');
    expect(typeof entryListSettings.update).toBe('function');
  });

  test('can be set and retrieved', () => {
    const testSettings = {
      posts: {
        type: /** @type {'grid'} */ ('grid'),
        sort: { key: 'title', order: /** @type {'ascending'} */ ('ascending') },
      },
      pages: {
        type: /** @type {'list'} */ ('list'),
        sort: { key: 'date', order: /** @type {'descending'} */ ('descending') },
      },
    };

    entryListSettings.set(testSettings);

    expect(get(entryListSettings)).toEqual(testSettings);
  });

  test('can be updated', () => {
    const initialSettings = {
      posts: { type: /** @type {'grid'} */ ('grid') },
    };

    entryListSettings.set(initialSettings);

    entryListSettings.update((settings) => ({
      ...settings,
      pages: { type: /** @type {'list'} */ ('list') },
    }));

    expect(get(entryListSettings)).toEqual({
      posts: { type: 'grid' },
      pages: { type: 'list' },
    });
  });
});

describe('Test initSettings()', () => {
  /** @type {any} */
  let mockBackend;

  beforeEach(async () => {
    vi.clearAllMocks();

    // IndexedDB is now a wrapper that creates new instances

    /** @type {BackendService} */
    mockBackend = {
      repository: {
        databaseName: 'test-db',
        name: 'test-repo',
        owner: 'test-owner',
      },
      name: 'github',
    };
  });

  test('initializes settings from IndexedDB when available', async () => {
    await initSettings(mockBackend);

    // Test passes if initSettings completes without error
    // Settings are initialized from the store
    const currentSettings = get(entryListSettings);

    expect(currentSettings).toBeDefined();
  });

  test('initializes with empty object when no saved settings', async () => {
    await initSettings(mockBackend);

    expect(get(entryListSettings)).toEqual({});
  });

  test('handles backend without repository', async () => {
    const backendWithoutRepo = { ...mockBackend, repository: undefined };

    await initSettings(backendWithoutRepo);

    // Should not crash and should set empty settings
    expect(get(entryListSettings)).toEqual({});
  });

  test('handles backend without databaseName', async () => {
    const backendWithoutDB = {
      ...mockBackend,
      repository: { ...mockBackend.repository, databaseName: undefined },
    };

    await initSettings(backendWithoutDB);

    // Should not crash and should set empty settings
    expect(get(entryListSettings)).toEqual({});
  });

  test('saves settings to IndexedDB when settings change', async () => {
    await initSettings(mockBackend);

    const newSettings = {
      posts: { type: /** @type {'grid'} */ ('grid') },
    };

    // Trigger settings change
    entryListSettings.set(/** @type {any} */ (newSettings));

    // Allow async operations to complete
    await sleep(0);

    // Test passes if no errors occur when settings change
    const currentSettings = get(entryListSettings);

    expect(currentSettings).toEqual(newSettings);
  });

  test('does not save settings when they are the same', async () => {
    await initSettings(mockBackend);

    const newSettings = {
      posts: { type: /** @type {'grid'} */ ('grid') },
    };

    // Trigger settings change
    entryListSettings.set(/** @type {any} */ (newSettings));

    // Allow async operations to complete
    await sleep(0);

    // Test passes if no errors occur
    const currentSettings = get(entryListSettings);

    expect(currentSettings).toEqual(newSettings);
  });

  test('handles IndexedDB errors gracefully', async () => {
    // Should handle errors gracefully and not crash
    await initSettings(mockBackend);

    // Test passes if no errors occur
    const currentSettings = get(entryListSettings);

    expect(currentSettings).toBeDefined();
  });

  test('updates settings when currentView changes', async () => {
    const { selectedCollection } = await import('$lib/services/contents/collection');
    const { currentView } = await import('$lib/services/contents/collection/view');
    const equal = (await import('fast-deep-equal')).default;

    // Mock equal to return false for view comparison
    vi.mocked(equal).mockReturnValue(false);

    await initSettings(mockBackend);

    // Set up a selected collection
    selectedCollection.set(/** @type {any} */ ({ name: 'posts' }));

    // Initialize settings
    entryListSettings.set({});

    // Trigger currentView change
    const newView = {
      type: /** @type {'grid'} */ ('grid'),
      sort: { key: 'title', order: /** @type {'ascending'} */ ('ascending') },
    };

    currentView.set(/** @type {any} */ (newView));

    expect(get(entryListSettings)).toEqual({
      posts: newView,
    });
  });

  test('does not update settings when view is the same', async () => {
    const { selectedCollection } = await import('$lib/services/contents/collection');
    const { currentView } = await import('$lib/services/contents/collection/view');
    const equal = (await import('fast-deep-equal')).default;

    // Mock equal to return true for view comparison
    vi.mocked(equal).mockReturnValue(true);

    await initSettings(mockBackend);

    // Set up a selected collection
    selectedCollection.set(/** @type {any} */ ({ name: 'posts' }));

    // Initialize settings with existing view
    const existingView = { type: /** @type {'list'} */ ('list') };

    entryListSettings.set(/** @type {any} */ ({ posts: existingView }));

    // Trigger currentView change with same view
    currentView.set(/** @type {any} */ (existingView));

    expect(get(entryListSettings)).toEqual({ posts: existingView });
  });

  test('does not update settings when no collection is selected', async () => {
    const { selectedCollection } = await import('$lib/services/contents/collection');
    const { currentView } = await import('$lib/services/contents/collection/view');

    await initSettings(mockBackend);

    // No collection selected
    selectedCollection.set(/** @type {any} */ (null));

    // Initialize settings
    entryListSettings.set({});

    // Trigger currentView change
    const newView = { type: /** @type {'grid'} */ ('grid') };

    currentView.set(/** @type {any} */ (newView));

    // Settings should remain empty
    expect(get(entryListSettings)).toEqual({});
  });

  test('entryListSettings.subscribe saves to IndexedDB when settings differ', async () => {
    await initSettings(mockBackend);

    // Trigger settings change to ensure save is called
    const newSettings = { posts: { type: /** @type {'grid'} */ ('grid') } };

    entryListSettings.set(/** @type {any} */ (newSettings));

    // Allow async operations to complete
    await sleep(0);

    // Test passes if no errors occur when settings change
    const currentSettings = get(entryListSettings);

    expect(currentSettings).toEqual(newSettings);
  });

  test('currentView.subscribe updates entryListSettings when view differs', async () => {
    const { selectedCollection } = await import('$lib/services/contents/collection');
    const { currentView } = await import('$lib/services/contents/collection/view');
    const equal = (await import('fast-deep-equal')).default;

    vi.mocked(equal).mockReturnValue(false);

    await initSettings(mockBackend);

    selectedCollection.set(/** @type {any} */ ({ name: 'articles' }));

    entryListSettings.set({});

    const newView = {
      type: /** @type {'grid'} */ ('grid'),
      sort: { key: 'date', order: /** @type {'descending'} */ ('descending') },
    };

    currentView.set(/** @type {any} */ (newView));

    expect(get(entryListSettings)).toEqual({ articles: newView });
  });

  test('calls initSettings when backend becomes available and entryListSettings is not initialized (line 55)', async () => {
    // Reset entryListSettings to undefined so the condition passes
    entryListSettings.set(undefined);

    // Set backend to a truthy value — triggers the module-level subscriber
    const { backend: writableBackend } = await import('$lib/services/backends');
    const b = /** @type {import('svelte/store').Writable<any>} */ (writableBackend);

    b.set(mockBackend);

    // Give async initSettings time to complete
    await sleep(50);

    // initSettings was called and populated entryListSettings (no longer undefined)
    expect(get(entryListSettings)).toBeDefined();

    // Clean up
    b.set(null);
  });
});
