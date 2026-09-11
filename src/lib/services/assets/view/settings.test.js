// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { selectedAssetFolder } from '$lib/services/assets/folders';
import { currentView, defaultView } from '$lib/services/assets/view';
import { initViewSettingsStorage } from '$lib/services/common/view';

import { assetListSettings, initSettings } from './settings.js';

// Real reactive boxes are used for the mocked state, so that the effects created by `initSettings`
// react to changes made by the tests
vi.mock('$lib/services/assets/folders', async () => {
  const { createRawState } = await import('$lib/services/utils/state.svelte');

  return { selectedAssetFolder: createRawState(undefined) };
});

vi.mock('$lib/services/assets/view', async () => {
  const { createRawState } = await import('$lib/services/utils/state.svelte');

  return {
    currentView: createRawState({ type: 'grid', showInfo: true }),
    defaultView: { type: 'grid', showInfo: true },
  };
});

vi.mock('$lib/services/common/view', () => ({
  initViewSettingsStorage: vi.fn(async (_repository, _key, state) => {
    state.current = {};
  }),
}));

/**
 * Wait for the effects to run.
 * @returns {Promise<void>} Promise that resolves after a short delay.
 */
const wait = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 10);
  });

/** @type {any} */
const backendService = { repository: { databaseName: 'test-db' } };
/** @type {any} */
const uploadsFolder = { internalPath: 'uploads', publicPath: '/uploads' };
/** @type {any} */
const imagesFolder = { internalPath: 'images', publicPath: '/images' };

describe('assets/view/settings', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    selectedAssetFolder.current = undefined;
    currentView.current = { type: 'grid', showInfo: true };
    assetListSettings.current = undefined;
    await wait();
  });

  describe('initSettings', () => {
    it('should initialize the settings with the repository database', async () => {
      await initSettings(backendService);

      expect(initViewSettingsStorage).toHaveBeenCalledWith(
        backendService.repository,
        'assets-view',
        assetListSettings,
      );

      await wait();

      // The current view is saved right away
      expect(assetListSettings.current).toEqual({ '*': { type: 'grid', showInfo: true } });
    });

    it('should restore the saved view when a different folder is selected', async () => {
      vi.mocked(initViewSettingsStorage).mockImplementationOnce(async (_repo, _key, state) => {
        state.current = { uploads: { type: 'list', showInfo: false } };
      });

      await initSettings(backendService);
      await wait();

      selectedAssetFolder.current = uploadsFolder;
      await wait();

      expect(currentView.current).toEqual({ type: 'list', showInfo: false });
    });

    it('should fall back to the default view for a folder without saved settings', async () => {
      await initSettings(backendService);
      await wait();

      currentView.current = { type: 'list', showInfo: true };
      await wait();

      selectedAssetFolder.current = imagesFolder;
      await wait();

      expect(currentView.current).toEqual(defaultView);
      // A clone is stored, so that the default view is never mutated
      expect(currentView.current).not.toBe(defaultView);
    });

    it('should save the view when it is changed', async () => {
      await initSettings(backendService);
      await wait();

      selectedAssetFolder.current = uploadsFolder;
      await wait();

      currentView.current = { type: 'list', showInfo: true };
      await wait();

      expect(assetListSettings.current).toEqual({
        '*': { type: 'grid', showInfo: true },
        uploads: { type: 'list', showInfo: true },
      });
    });

    it('should save the view under `*` when no folder is selected', async () => {
      await initSettings(backendService);
      await wait();

      currentView.current = { type: 'list', showInfo: true };
      await wait();

      expect(assetListSettings.current).toEqual({ '*': { type: 'list', showInfo: true } });
    });

    it('should not save the view when it is equal to the saved view', async () => {
      vi.mocked(initViewSettingsStorage).mockImplementationOnce(async (_repo, _key, state) => {
        state.current = { '*': { type: 'grid', showInfo: true } };
      });

      await initSettings(backendService);
      await wait();

      const settings = assetListSettings.current;

      currentView.current = { type: 'grid', showInfo: true };
      await wait();

      // The same object is kept, so nothing is persisted
      expect(assetListSettings.current).toBe(settings);
    });

    it('should handle an undefined repository', async () => {
      await expect(initSettings(/** @type {any} */ ({}))).resolves.toBeUndefined();

      expect(initViewSettingsStorage).toHaveBeenCalledWith(
        undefined,
        'assets-view',
        assetListSettings,
      );
    });
  });
});
