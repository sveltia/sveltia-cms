// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { backend } from '$lib/services/backends';
import { selectAssetsView } from '$lib/services/contents/editor';

import { entryEditorSettings, initSettings } from './settings.js';

const { mockDB, mockIndexedDB } = vi.hoisted(() => {
  const db = { get: vi.fn(), set: vi.fn() };

  return {
    mockDB: db,
    // eslint-disable-next-line prefer-arrow-callback, func-names
    mockIndexedDB: vi.fn(function () {
      return db;
    }),
  };
});

vi.mock('@sveltia/utils/storage', () => ({
  IndexedDB: mockIndexedDB,
}));

// Real reactive boxes are used for the mocked state, so that the effects in the module under test
// react to changes made by the tests
vi.mock('$lib/services/backends', async () => {
  const { createRawState } = await import('$lib/services/utils/state.svelte');

  return { backend: createRawState(undefined) };
});

vi.mock('$lib/services/contents/editor', async () => {
  const { createRawState } = await import('$lib/services/utils/state.svelte');

  return { selectAssetsView: createRawState(undefined) };
});

/**
 * Wait for the effects to run.
 * @returns {Promise<void>} Promise that resolves after a short delay.
 */
const wait = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 10);
  });

/** @type {any} */
const DEFAULT_SETTINGS = {
  showSecondPane: true,
  showPreview: true,
  syncScrolling: true,
  selectAssetsView: { type: 'grid' },
};

/** @type {any} */
const backendService = { repository: { databaseName: 'test-db' } };

describe('editor/settings', () => {
  beforeEach(async () => {
    // Stop the effects created by the previous test, so they don’t persist the state reset below
    await initSettings(/** @type {any} */ ({}));
    vi.clearAllMocks();
    mockDB.get.mockResolvedValue(undefined);
    mockDB.set.mockResolvedValue(undefined);
    /** @type {any} */ (backend).current = undefined;
    selectAssetsView.current = undefined;
    entryEditorSettings.current = undefined;
    await wait();
  });

  describe('entryEditorSettings state', () => {
    it('should be reactive state', () => {
      expect('current' in entryEditorSettings).toBe(true);
    });

    it('should allow setting new values', () => {
      /** @type {any} */
      const settings = { showPreview: false, syncScrolling: true };

      entryEditorSettings.current = settings;
      expect(entryEditorSettings.current).toBe(settings);
    });
  });

  describe('initSettings', () => {
    it('should initialize with the default settings when nothing is saved', async () => {
      await initSettings(backendService);

      expect(mockIndexedDB).toHaveBeenCalledWith('test-db', 'ui-settings');
      expect(mockDB.get).toHaveBeenCalledWith('entry-view');
      expect(entryEditorSettings.current).toEqual(DEFAULT_SETTINGS);
      expect(selectAssetsView.current).toEqual({ type: 'grid' });
    });

    it('should merge the saved settings with the defaults', async () => {
      mockDB.get.mockResolvedValue({ showPreview: false, selectAssetsView: { type: 'list' } });

      await initSettings(backendService);

      expect(entryEditorSettings.current).toEqual({
        ...DEFAULT_SETTINGS,
        showPreview: false,
        selectAssetsView: { type: 'list' },
      });
      expect(selectAssetsView.current).toEqual({ type: 'list' });
    });

    it('should work without a repository database', async () => {
      await initSettings(/** @type {any} */ ({}));

      expect(mockIndexedDB).not.toHaveBeenCalled();
      expect(entryEditorSettings.current).toEqual(DEFAULT_SETTINGS);
    });

    it('should save the settings to the database when they are changed', async () => {
      await initSettings(backendService);
      await wait();

      entryEditorSettings.current = { ...DEFAULT_SETTINGS, showPreview: false };
      await wait();

      expect(mockDB.set).toHaveBeenCalledWith('entry-view', {
        ...DEFAULT_SETTINGS,
        showPreview: false,
      });
    });

    it('should not save the settings when they are equal to the saved ones', async () => {
      mockDB.get.mockResolvedValue(DEFAULT_SETTINGS);

      await initSettings(backendService);
      await wait();

      expect(mockDB.set).not.toHaveBeenCalled();
    });

    it('should ignore database errors', async () => {
      await initSettings(backendService);
      await wait();

      mockDB.set.mockRejectedValue(new Error('Storage error'));
      entryEditorSettings.current = { ...DEFAULT_SETTINGS, showPreview: false };
      await wait();

      expect(mockDB.set).toHaveBeenCalled();
      expect(entryEditorSettings.current?.showPreview).toBe(false);
    });

    it('should save the Select Assets dialog view to the settings', async () => {
      await initSettings(backendService);
      await wait();

      selectAssetsView.current = { type: 'list' };
      await wait();

      expect(entryEditorSettings.current).toEqual({
        ...DEFAULT_SETTINGS,
        selectAssetsView: { type: 'list' },
      });
    });

    it('should save the Select Assets dialog view even when none is saved yet', async () => {
      await initSettings(backendService);
      await wait();

      entryEditorSettings.current = { showPreview: true };
      selectAssetsView.current = { type: 'list' };
      await wait();

      expect(entryEditorSettings.current).toEqual({
        showPreview: true,
        selectAssetsView: { type: 'list' },
      });
    });

    it('should ignore an empty Select Assets dialog view', async () => {
      await initSettings(backendService);
      await wait();

      const settings = entryEditorSettings.current;

      selectAssetsView.current = /** @type {any} */ ({});
      await wait();

      expect(entryEditorSettings.current).toBe(settings);

      selectAssetsView.current = undefined;
      await wait();

      expect(entryEditorSettings.current).toBe(settings);
    });

    it('should not update the settings when the view is unchanged', async () => {
      await initSettings(backendService);
      await wait();

      const settings = entryEditorSettings.current;

      selectAssetsView.current = { type: 'grid' };
      await wait();

      expect(entryEditorSettings.current).toBe(settings);
    });

    it('should stop the previous effects when initialized again', async () => {
      await initSettings(backendService);
      await wait();
      await initSettings(backendService);
      await wait();

      mockDB.set.mockClear();
      entryEditorSettings.current = { ...DEFAULT_SETTINGS, showPreview: false };
      await wait();

      // Only the effect created by the second call saves the settings
      expect(mockDB.set).toHaveBeenCalledTimes(1);
    });
  });

  describe('backend effect', () => {
    it('should initialize the settings once a backend is selected', async () => {
      /** @type {any} */ (backend).current = backendService;
      await wait();

      expect(mockIndexedDB).toHaveBeenCalledWith('test-db', 'ui-settings');
      expect(entryEditorSettings.current).toEqual(DEFAULT_SETTINGS);
    });

    it('should not initialize the settings again when they are already initialized', async () => {
      entryEditorSettings.current = DEFAULT_SETTINGS;
      /** @type {any} */ (backend).current = backendService;
      await wait();

      expect(mockIndexedDB).not.toHaveBeenCalled();
    });
  });
});
