import { sleep } from '@sveltia/utils/misc';
import { get, writable } from 'svelte/store';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { entryListSettings, initSettings } from './settings';

/**
 * @import { BackendService } from '$lib/types/private';
 */

// Mock dependencies
vi.mock('@sveltia/utils/storage', () => ({
  IndexedDB: vi.fn().mockImplementation(() => ({
    get: vi.fn(),
    set: vi.fn(),
  })),
}));

vi.mock('$lib/services/backends', () => ({
  backend: writable(null),
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
  let mockIndexedDB;
  /** @type {any} */
  let mockBackend;

  beforeEach(async () => {
    vi.clearAllMocks();

    const { IndexedDB } = await import('@sveltia/utils/storage');

    mockIndexedDB = {
      get: vi.fn(),
      set: vi.fn(),
    };

    vi.mocked(IndexedDB).mockReturnValue(/** @type {any} */ (mockIndexedDB));

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
    const savedSettings = {
      posts: { type: 'grid', sort: { key: 'title', order: 'ascending' } },
    };

    mockIndexedDB.get.mockResolvedValue(savedSettings);

    await initSettings(mockBackend);

    expect(mockIndexedDB.get).toHaveBeenCalledWith('contents-view');
    expect(get(entryListSettings)).toEqual(savedSettings);
  });

  test('initializes with empty object when no saved settings', async () => {
    mockIndexedDB.get.mockResolvedValue(null);

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
    const equal = (await import('fast-deep-equal')).default;

    vi.mocked(equal).mockReturnValue(false); // Simulate settings being different

    mockIndexedDB.get.mockResolvedValue({});

    await initSettings(mockBackend);

    const newSettings = {
      posts: { type: /** @type {'grid'} */ ('grid') },
    };

    // Trigger settings change
    entryListSettings.set(/** @type {any} */ (newSettings));

    // Allow async operations to complete
    await sleep(0);

    expect(mockIndexedDB.set).toHaveBeenCalledWith('contents-view', newSettings);
  });

  test('does not save settings when they are the same', async () => {
    const equal = (await import('fast-deep-equal')).default;

    vi.mocked(equal).mockReturnValue(true); // Simulate settings being the same

    mockIndexedDB.get.mockResolvedValue({});

    await initSettings(mockBackend);

    const newSettings = {
      posts: { type: /** @type {'grid'} */ ('grid') },
    };

    // Trigger settings change
    entryListSettings.set(/** @type {any} */ (newSettings));

    // Allow async operations to complete
    await sleep(0);

    expect(mockIndexedDB.set).not.toHaveBeenCalled();
  });

  test('handles IndexedDB errors gracefully', async () => {
    mockIndexedDB.get.mockRejectedValue(new Error('IndexedDB error'));
    mockIndexedDB.set.mockRejectedValue(new Error('IndexedDB error'));

    // Should handle errors gracefully and not crash
    try {
      await initSettings(mockBackend);
    } catch (/** @type {any} */ error) {
      // The function may throw but it should be an expected error
      expect(error.message).toBe('IndexedDB error');
    }

    // Verify that IndexedDB was attempted to be accessed
    expect(mockIndexedDB.get).toHaveBeenCalledWith('contents-view');
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
});
